const { test } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const { createDesign, MAX_STICKERS } = require("../.test-build/editor-design");
const { layouts, getLayoutAspect } = require("../.test-build/layout");
const { decoratedFrames, decoratedFramePatch, selectedDecoratedFrame, frameAsset, isFrameDecoration } = require("../.test-build/decorated-frames");
const { diffDesign, applyDesignChanges } = require("../.test-build/room-design");

const customSticker = index => ({
  id: `custom-${index}`, src: "/stickers/cute/daisy.svg", name: "My daisy",
  x: 0.5, y: 0.5, size: 0.2, rotation: 0, flipped: false,
});

test("decorated frames have local assets and supported geometry for every layout", () => {
  for (const preset of decoratedFrames) {
    for (const asset of preset.assets) assert.ok(existsSync(`public${frameAsset(asset).src}`));
    for (const layout of layouts) {
      const patch = decoratedFramePatch(createDesign(), preset, getLayoutAspect(layout));
      assert.equal(patch.stickers.length, 6);
      assert.equal(new Set(patch.stickers.map(sticker => sticker.id)).size, 6);
      for (const sticker of patch.stickers) {
        assert.ok(sticker.size >= 0.08 && sticker.size <= 0.8);
        assert.ok(sticker.x >= 0 && sticker.x <= 1);
        assert.ok(sticker.y >= 0 && sticker.y <= 1);
        assert.match(sticker.id, /^[a-zA-Z0-9_-]{1,64}$/);
      }
    }
  }
});

test("switching decorated frames replaces their decorations while keeping custom work", () => {
  let design = { ...createDesign(), stickers: [customSticker(0)], caption: { ...createDesign().caption, text: "Our day" } };
  for (const preset of decoratedFrames) {
    design = { ...design, ...decoratedFramePatch(design, preset, 1) };
    assert.equal(design.stickers.length, 7);
    assert.equal(design.stickers.filter(isFrameDecoration).length, 6);
    assert.deepEqual(design.stickers.find(sticker => sticker.id === "custom-0"), customSticker(0));
    assert.equal(design.caption.text, "Our day");
    assert.equal(selectedDecoratedFrame(design), preset.id);
  }
});

test("decorated frames preserve the 24 sticker limit without deleting custom stickers", () => {
  const design = { ...createDesign(), stickers: Array.from({ length: MAX_STICKERS - 5 }, (_, i) => customSticker(i)) };
  assert.equal(decoratedFramePatch(design, decoratedFrames[0], 1), null);
  assert.equal(design.stickers.length, MAX_STICKERS - 5);
});

test("decorated frame changes sync through existing per-property room edits", () => {
  const before = { ...createDesign(), stickers: [customSticker(0)] };
  const after = { ...before, ...decoratedFramePatch(before, decoratedFrames[0], 0.5) };
  const changes = diffDesign(before, after);
  assert.deepEqual(applyDesignChanges(before, changes), after);
});
