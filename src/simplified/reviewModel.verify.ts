import { reviewTimelineSegments } from "./reviewTimeline";
import { transcriptReviewHints } from "./reviewHints";
import assert from "node:assert/strict";
import { historyReduce } from "../editor/reduce";
import { buildCommands } from "../editor/storeCommandBuilder";
import { activeEditorState, type ProjectDoc } from "../editor/types";
import { docFromTimeline } from "../persist/projectStore";
import { runProjectMigrations } from "../persist/migrations";
import {
  buildReviewModel,
  planReviewCut,
  planReviewRestore,
  reviewFinalText,
  reviewSrt,
  sourceToTimeline,
} from "./reviewModel";
import type { MediaAsset, TimelineItem } from "../editor/types";
let n = 0;
const id = () => `cut-${++n}`;
const words = [
  { text: "Primeira", start: 0, end: 800 },
  { text: "frase.", start: 800, end: 1500 },
  { text: "Este", start: 2000, end: 2700 },
  { text: "erro.", start: 2700, end: 3500 },
  { text: "Final", start: 4000, end: 4700 },
  { text: "certo.", start: 4700, end: 5500 },
];
const asset: MediaAsset = {
  id: "source",
  name: "story.mp4",
  kind: "video",
  src: "/media/uploads/story.mp4",
  durationInFrames: 180,
  transcript: words,
  width: 180,
  height: 320,
};
const clip: TimelineItem = {
  id: "video",
  sourceAssetId: "source",
  kind: "video",
  src: asset.src,
  name: asset.name,
  track: "V1",
  startFrame: 0,
  durationInFrames: 180,
  volume: 1,
  transcript: words,
};
const initial = docFromTimeline({
  fps: 30,
  width: 180,
  height: 320,
  items: [clip],
  assets: [asset],
  selectedId: null,
  tracks: { V1: { kind: "video" } },
  trackOrder: ["V1"],
});
let history = {
  past: [] as ProjectDoc[],
  present: initial,
  future: [] as ProjectDoc[],
};
const commands = buildCommands(
  (action) => {
    history = historyReduce(history, action);
  },
  () => history.present,
);
const editor = {
  commands,
  getDoc: () => history.present,
  getState: () => activeEditorState(history.present),
};
const model = () =>
  buildReviewModel(editor.getState(), editor.getDoc().assets[0]!);
assert.equal(model().rows.length, 3);
const before = JSON.stringify(editor.getDoc());
const cut = model().rows[1]!;
editor.commands.batch(planReviewCut(model(), cut, id), "cut");
assert.equal(
  editor.getState().items.length,
  2,
  "the video is physically split into real timeline clips",
);
assert.equal(
  editor.getState().items.reduce((s, c) => s + c.durationInFrames, 0),
  120,
  "two seconds removed from the real video",
);
assert.equal(model().rows[1]!.keptFrames, 0);
assert.equal(
  sourceToTimeline(model(), 120),
  60,
  "last phrase ripples to two seconds",
);
assert.doesNotMatch(reviewFinalText(model(), 30), /erro/);
assert.equal(
  editor.getState().items.at(-1)!.transcript?.at(-1)?.text,
  "certo.",
  "repeated video splits keep source-timed words for advanced captions",
);
assert.match(reviewSrt(model(), 30), /00:00:02,000/);
const reopened = runProjectMigrations(
  JSON.parse(JSON.stringify(editor.getDoc())),
);
assert.ok(reopened);
const reopenedState = activeEditorState(reopened!.doc);
assert.equal(
  buildReviewModel(reopenedState, reopened!.doc.assets[0]!).rows[1]!.keptFrames,
  0,
);
const savedText = reviewFinalText(model(), 30);
editor.commands.undo();
assert.equal(JSON.stringify(editor.getDoc()), before, "cut is one undo step");
editor.commands.redo();
assert.equal(reviewFinalText(model(), 30), savedText);
editor.commands.batch(planReviewRestore(model(), cut, "V1", id), "restore");
assert.equal(
  editor.getState().items.reduce((s, c) => s + c.durationInFrames, 0),
  180,
);
assert.equal(
  reviewFinalText(model(), 30),
  "Primeira frase. Este erro. Final certo.",
);
// Restoration is derived from real clip windows, including cuts made in advanced mode.
editor.commands.removeItem(
  editor.getState().items.find((c) => c.srcInFrame === 60)!.id,
);
assert.equal(model().rows[1]!.keptFrames, 0);
// A repeated source is not silently flattened by this review surface.
const duplicate = { ...clip, id: "again", startFrame: 200 };
assert.ok(
  buildReviewModel({ ...editor.getState(), items: [clip, duplicate] }, asset)
    .blocker,
);
// Correct text without replacing timestamps or transcript identities.
const old = editor.getDoc().assets[0]!.transcript![0]!;
editor.commands.batch([
  {
    type: "pool.fixTranscriptWord",
    id: asset.id,
    wordIndex: 0,
    text: "Inicial",
  },
]);
assert.deepEqual(editor.getDoc().assets[0]!.transcript![0], {
  ...old,
  text: "Inicial",
});
console.log(
  "reviewModel.verify: real video cuts, restore, undo/redo, source preservation, captions, persistence and advanced edits passed",
);

const withoutMaster = { ...asset, transcript: undefined };
const sourceOnly = buildReviewModel(
  { ...editor.getState(), assets: [withoutMaster], items: [clip] },
  withoutMaster,
);
assert.equal(
  planReviewCut(sourceOnly, sourceOnly.rows[1]!, id)[0]?.type,
  "pool.setTranscription",
  "track-only transcripts are preserved on the master before removal",
);

// Suggestion labels come from the real text, never a canned result or a cut action.
const hintRows = [
  { id: "normal", text: "Esse livro é um dos meus favoritos." },
  { id: "uncertain", text: "Foi publicado em 2018, se não me engano." },
  { id: "retake", text: "Não, espera, falei errado. Vou começar de novo." },
  { id: "negative", text: "Eu não errei ao escolher este livro." },
  { id: "repeat", text: "Esse livro é um dos meus favoritos!" },
];
const hintSnapshot = JSON.stringify(hintRows);
const hints = transcriptReviewHints(hintRows);
assert.equal(hints.get("uncertain")?.label, "Verificar");
assert.equal(hints.get("retake")?.label, "Provável erro");
assert.equal(hints.get("repeat")?.kind, "check");
assert.equal(hints.has("normal"), false);
assert.equal(hints.has("negative"), false);
assert.equal(
  hintSnapshot,
  JSON.stringify(hintRows),
  "hints never change the project",
);
assert.equal(
  transcriptReviewHints([
    { id: "retake", text: "Agora a fala está corrigida." },
  ]).size,
  0,
);
console.log(
  "review hints: contextual clues, accents, repeats, correction and no automatic edits passed",
);

const paletteModel = {
  ...model(),
  duration: 180,
  rows: model().rows.map((row, i) => ({
    ...row,
    text:
      i === 0
        ? "Se não me engano."
        : i === 1
          ? "Falei errado."
          : "Segue a leitura.",
  })),
  kept: [
    { start: 0, end: 45 },
    { start: 70, end: 180 },
  ],
};
const segments = reviewTimelineSegments(paletteModel, [
  { start: 100, end: 110 },
]);
assert.equal(
  segments.reduce((sum, segment) => sum + segment.end - segment.start, 0),
  180,
);
assert.equal(segments.find((segment) => segment.start === 0)?.kind, "check");
assert.ok(
  segments.some((segment) => segment.kind === "error" && segment.removed),
);
assert.ok(segments.some((segment) => segment.kind === "pause"));
assert.equal(
  segments
    .filter((segment) => segment.removed)
    .reduce((sum, segment) => sum + segment.end - segment.start, 0),
  25,
);
console.log(
  "review timeline: complete source coverage, shared hint kinds and real removed windows passed",
);
