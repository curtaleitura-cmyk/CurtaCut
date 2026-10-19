// Actual browser acceptance check. Every fixture stays in an isolated profile.
import assert from "node:assert/strict";
import { verifyReviewAppearance } from "./reviewAppearance.browser.mjs";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  rm,
  chmod,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpeg from "ffmpeg-static";
import ffprobe from "@ffprobe-installer/ffprobe";
import { openBrowser } from "@remotion/renderer";
const repo = fileURLToPath(new URL("../../", import.meta.url));
const profile = await mkdtemp(join(tmpdir(), "curtacut-simple-browser-"));
const uploads = join(profile, "media", "uploads");
const downloads = join(profile, "downloads");
const screenshots =
  process.env.CC_SIMPLE_SCREENSHOTS ?? join(profile, "screenshots");
await Promise.all([
  mkdir(uploads, { recursive: true }),
  mkdir(downloads, { recursive: true }),
  mkdir(screenshots, { recursive: true }),
]);
await writeFile(join(profile, "settings.env"), "");
if (process.platform !== "win32") await chmod(ffprobe.path, 0o755);
const sourcePath = join(uploads, "validacao.mp4");
await promisify(execFile)(ffmpeg, [
  "-v",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=720x1280:rate=30:duration=18,format=gray",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:sample_rate=48000:duration=18",
  "-c:v",
  "libx264",
  "-preset",
  "ultrafast",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-shortest",
  sourcePath,
]);
const sourceHash = createHash("sha256")
  .update(await readFile(sourcePath))
  .digest("hex");
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(path|home|userprofile|appdata|localappdata|temp|tmp|tmpdir|systemroot|windir|comspec|pathext|lang|ci)$/i.test(
      key,
    ),
  ),
);
Object.assign(env, {
  OPENCHATCUT_DATA_DIR: profile,
  OPENCHATCUT_DEV_PROFILE_ID: randomUUID(),
  MEDIA_DIR: uploads,
  BROWSER: "none",
});
const server = spawn(
  process.execPath,
  [
    join(repo, "node_modules/vite/bin/vite.js"),
    "--config",
    join(repo, "config/vite.config.ts"),
    "--host",
    "127.0.0.1",
    "--port",
    "5201",
    "--strictPort",
  ],
  { cwd: repo, env, stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "";
for (const stream of [server.stdout, server.stderr])
  stream.on("data", (data) => {
    serverLog = (serverLog + data.toString()).slice(-4000);
  });
let ready = false;
for (let i = 0; i < 150; i++) {
  try {
    const response = await fetch("http://127.0.0.1:5201/");
    if (response.ok) {
      await response.text();
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 200));
}
if (!ready) {
  server.kill();
  throw new Error(`isolated test server did not start: ${serverLog}`);
}
let browser;
const errors = [];
try {
  browser = await openBrowser("chrome", {
    chromiumOptions: { gl: "swiftshader" },
    logLevel: "error",
  });
  const page = await browser.newPage({
    context: () => null,
    logLevel: "error",
    indent: false,
    pageIndex: 0,
    onBrowserLog: null,
    onLog: () => {},
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page._client().on("Page.javascriptDialogOpening", async () => {
    await page._client().send("Page.handleJavaScriptDialog", { accept: true });
  });
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await page._client().send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloads,
  });
  await page.goto({ url: "http://127.0.0.1:5201/", timeout: 60000 });

  const projectId = await page.evaluate(async () => {
    const store = await import("/src/persist/projectStore.ts");
    localStorage.setItem("cc.locale", "pt-BR");
    localStorage.setItem("cc.simplifiedEditor", "1");
    const phrases = [
      "Esse livro foi publicado em 2018, se não me engano.",
      "Não, espera, falei errado. Vou começar de novo.",
      "Agora a narrativa continua com o trecho que queremos manter.",
      "Podemos revisar cada frase e ouvir se a edição ficou natural.",
    ];
    const transcript = phrases.flatMap((text, p) =>
      text.split(" ").map((text, i) => ({
        text,
        start: p * 4500 + i * 350,
        end: p * 4500 + i * 350 + 300,
      })),
    );
    const asset = {
      id: "qa-real-video",
      kind: "video",
      name: "Vídeo sintético de validação.mp4",
      src: "/media/uploads/validacao.mp4",
      durationInFrames: 540,
      width: 720,
      height: 1280,
      transcript,
    };
    const clip = {
      id: "qa-clip",
      sourceAssetId: asset.id,
      kind: "video",
      name: asset.name,
      src: asset.src,
      track: "V1",
      startFrame: 0,
      durationInFrames: 540,
      volume: 1,
      transcript,
    };
    const doc = store.docFromTimeline({
      fps: 30,
      width: 720,
      height: 1280,
      items: [clip],
      assets: [asset],
      selectedId: null,
      trackOrder: ["V1"],
      tracks: { V1: { kind: "video" } },
    });
    const project = await store.createProject(
      "Validação · vídeo e transcrição de teste",
      doc,
    );
    return project.id;
  });

  await new Promise((resolve) => setTimeout(resolve, 800));
  await page.evaluate(async () => {
    const store = await import("/src/persist/projectStore.ts");
    await store.flushProjectSaves();
  });
  await page.goto({
    url: `http://127.0.0.1:5201/?qa=${Date.now()}#/editor/${projectId}`,
    timeout: 60000,
  });
  async function wait(test, label) {
    for (let i = 0; i < 150; i++) {
      if (await page.evaluate(test)) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    throw Error(
      "Timeout: " +
        label +
        " " +
        JSON.stringify(
          await page.evaluate(() => ({
            text: document.body.innerText.slice(0, 1700),
            url: location.href,
          })),
        ),
    );
  }
  async function click(text) {
    const found = await page.evaluate((text) => {
      const selector = ["Marcar corte", "Restaurar"].includes(text)
        ? ".cc-simple-tools button"
        : "button";
      const b = [...document.querySelectorAll(selector)].find(
        (b) => b.textContent.trim() === text,
      );
      if (!b || b.disabled) return false;
      b.click();
      return true;
    }, text);
    assert.ok(found, "button " + text);
  }
  async function capture(name) {
    await new Promise((r) => setTimeout(r, 600));
    const { value } = await page._client().send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      `${screenshots}/${name}`,
      Buffer.from(value.data, "base64"),
    );
  }
  await wait(
    () => document.querySelectorAll(".cc-simple-row").length >= 4,
    "review rows",
  );
  await wait(
    () => document.querySelector(".cc-simple-thumbs img")?.complete,
    "filmstrip",
  );
  assert.ok(
    await page.evaluate(() =>
      [...document.querySelectorAll(".cc-simple-row .cc-simple-badge")].some(
        (el) => el.textContent === "Verificar",
      ),
    ),
    "real uncertainty badge",
  );
  assert.ok(
    await page.evaluate(() =>
      [...document.querySelectorAll(".cc-simple-row .cc-simple-badge")].some(
        (el) => el.textContent === "Provável erro",
      ),
    ),
    "real retake badge",
  );
  assert.ok(
    await page.evaluate(
      () =>
        !!document.querySelector(
          ".cc-simple-pause-row .cc-simple-badge.is-pause",
        ),
    ),
    "timestamp pause badge",
  );
  await click("Cortes sugeridos pela IA");
  await wait(
    () => !!document.querySelector(".cc-simple-suggestion small"),
    "visible suggestion reasons",
  );
  assert.match(
    await page.evaluate(
      () => document.querySelector(".cc-simple-scroll").innerText,
    ),
    /regras de texto/,
  );
  await click("Transcrição");
  await capture("simplified-before-cut.png");
  await page.evaluate(() =>
    document.querySelectorAll(".cc-simple-row-text")[1].click(),
  );
  await new Promise((r) => setTimeout(r, 150));
  await click("Marcar corte");
  await wait(
    () => !!document.querySelector(".cc-simple-row.is-cut"),
    "real cut row",
  );
  await capture("simplified-after-cut.png");
  await verifyReviewAppearance(page, capture, wait);
  // Persisted state is the original project's real split video clips.
  await new Promise((r) => setTimeout(r, 2400));

  const saved = await page.evaluate(async (id) => {
    const { loadProject } = await import("/src/persist/projectStore.ts");
    return await loadProject(id);
  }, projectId);
  await writeFile(join(profile, "cut-project.json"), JSON.stringify(saved));
  assert.equal(
    saved.timelines[0].items.length,
    2,
    "real project holds the split video",
  );
  assert.ok(
    saved.timelines[0].items.reduce((sum, c) => sum + c.durationInFrames, 0) <
      540,
  );
  await click("Gerar SRT do vídeo selecionado");
  await new Promise((r) => setTimeout(r, 900));
  const files = await readdir(downloads);
  assert.ok(
    files.some((f) => f.endsWith(".srt")),
    "downloaded real SRT",
  );
  const srt = await readFile(
    join(
      downloads,
      files.find((f) => f.endsWith(".srt")),
    ),
    "utf8",
  );
  assert.doesNotMatch(srt, /falei errado/);
  assert.match(srt, /narrativa/);
  await page.evaluate(() =>
    document.querySelector(".cc-simple-row.is-cut .cc-simple-row-text").click(),
  );
  await new Promise((r) => setTimeout(r, 100));
  await click("Ouvir com o corte");
  await new Promise((r) => setTimeout(r, 700));
  await click("Abrir editor avançado");
  await wait(() => !document.querySelector(".cc-simple"), "advanced view");
  await capture("simplified-shared-advanced-timeline.png");
  await page.evaluate(() =>
    document.querySelector('button[aria-label="Desfazer"]').click(),
  );
  await click("Edição simplificada");
  await wait(
    () => document.querySelectorAll(".cc-simple-row.is-cut").length === 0,
    "advanced undo shared with simplified view",
  );
  await click("Refazer");
  await wait(
    () => !!document.querySelector(".cc-simple-row.is-cut"),
    "shared redo retained",
  );
  await page.evaluate(() =>
    document.querySelector(".cc-simple-row.is-cut .cc-simple-row-text").click(),
  );
  await new Promise((r) => setTimeout(r, 100));
  await click("Restaurar");
  await wait(
    () => document.querySelectorAll(".cc-simple-row.is-cut").length === 0,
    "restored",
  );
  await click("Desfazer");
  await wait(
    () => !!document.querySelector(".cc-simple-row.is-cut"),
    "undo restore",
  );

  await new Promise((resolve) => setTimeout(resolve, 800));
  await page.evaluate(async () => {
    const store = await import("/src/persist/projectStore.ts");
    await store.flushProjectSaves();
  });
  await page.goto({
    url: `http://127.0.0.1:5201/?qa=${Date.now()}#/editor/${projectId}`,
    timeout: 60000,
  });
  await wait(
    () => !!document.querySelector(".cc-simple-row.is-cut"),
    "saved cut reopens",
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.ccSkin),
    "latte",
    "appearance survives reopening",
  );
  await page.evaluate(() => {
    const select = document.querySelector('select[aria-label="Aparência"]');
    select.value = "dark";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(
    () => !document.documentElement.dataset.ccSkin,
    "dark appearance restored",
  );
  await capture("simplified-reopened-project.png");
  console.log(
    "BROWSER-QA-OK: actual cut, SRT download, join playback, shared advanced editor, restore, undo and reopen",
  );
  assert.deepEqual(errors, [], "no browser JavaScript errors");
  await click("Exportar vídeo");
  await wait(
    () => !!document.querySelector('[aria-labelledby="cc-export-title"]'),
    "existing export dialog",
  );
  const after = await readFile(sourcePath);
  assert.equal(
    createHash("sha256").update(after).digest("hex"),
    sourceHash,
    "original media is unchanged",
  );
} finally {
  if (browser) await browser.close({ silent: true });
  if (server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 300,
  });
}
