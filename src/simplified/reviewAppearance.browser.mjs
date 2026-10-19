import assert from "node:assert/strict";

export async function verifyReviewAppearance(page, capture, wait) {
  const colours = () =>
    page.evaluate(() => {
      const colour = (selector) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).backgroundColor : null;
      };
      return ["check", "error", "pause"].map((kind) => [
        kind,
        colour(`.cc-simple-badge.is-${kind}`),
        colour(`.cc-simple-ruler .${kind}`),
      ]);
    });
  for (const [kind, badge, segment] of await colours()) {
    assert.ok(
      badge && segment,
      `${kind} badge and real timeline segment exist`,
    );
    assert.equal(
      badge,
      segment,
      `${kind} uses the same colour in badge and timeline`,
    );
  }
  assert.ok(
    await page.evaluate(
      () => !!document.querySelector(".cc-simple-ruler .is-removed"),
    ),
    "real cuts remain distinguished from suggestions",
  );
  await page.evaluate(() => {
    const select = document.querySelector('select[aria-label="Aparência"]');
    select.value = "light";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(
    () => document.documentElement.dataset.ccSkin === "latte",
    "global light appearance",
  );
  const light = await page.evaluate(() => {
    const panel = getComputedStyle(document.querySelector(".cc-simple-watch"));
    return {
      background: panel.backgroundColor,
      radius: panel.borderRadius,
      text: getComputedStyle(document.querySelector(".cc-simple")).color,
    };
  });
  const luminance = (colour) => {
    const channels = colour
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  assert.ok(luminance(light.background) > 0.7, "panels actually become light");
  assert.ok(
    (luminance(light.background) + 0.05) / (luminance(light.text) + 0.05) >=
      4.5,
    "light text remains readable",
  );
  assert.ok(parseFloat(light.radius) > 0, "panels have rounded corners");
  for (const [kind, badge, segment] of await colours())
    assert.equal(badge, segment, `${kind} colour remains shared in light mode`);
  await capture("simplified-light.png");
  console.log(
    "APPEARANCE-QA-OK: matching badge/timeline colours, actual cut hatch, rounded panels, global light mode and readable text",
  );
}
