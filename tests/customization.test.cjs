const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { layouts, getCells, getSlotCount, getLayoutAspect } = require("../.test-build/layout");
const { createSession, sessionReducer } = require("../.test-build/photobooth-session");
const { createDesign, normalizeSticker, addSticker, MAX_STICKERS } = require("../.test-build/editor-design");
const { photoFilters, defaultEffects, getFilterOperations, applyFilterOperations } = require("../.test-build/photo-filters");
const { stickerCatalog } = require("../.test-build/stickers");
const { patternSvg, decorationSvg } = require("../.test-build/frame-art");

test("all 25 layouts completely tile their grids without overlaps or phantom photo slots", () => {
  assert.equal(layouts.length, 25);
  assert.equal(new Set(layouts.map((layout) => layout.id)).size, 25);
  for (const layout of layouts) {
    const occupied = new Set();
    const cells = getCells(layout);
    assert.equal(cells.length, getSlotCount(layout));
    assert.ok(cells.length <= 9);
    assert.ok(getLayoutAspect(layout) > 0);
    for (const cell of cells) {
      for (let row = cell.row; row < cell.row + (cell.rows ?? 1); row++) {
        for (let col = cell.col; col < cell.col + (cell.cols ?? 1); col++) {
          assert.ok(row >= 0 && row < layout.rows && col >= 0 && col < layout.cols);
          const key = `${row}:${col}`;
          assert.equal(occupied.has(key), false, `overlap in ${layout.id}`);
          occupied.add(key);
        }
      }
    }
    assert.equal(occupied.size, layout.rows * layout.cols);
  }
});

test("every one of the 60 catalogue stickers has a local asset and a source record", () => {
  assert.equal(stickerCatalog.length, 60);
  const sources = JSON.parse(fs.readFileSync(path.join(__dirname, "../public/stickers/sources.json"), "utf8"));
  for (const asset of stickerCatalog) {
    assert.ok(fs.existsSync(path.join(__dirname, "../public", asset.src)), asset.src);
    assert.ok(sources.some((source) => source.path === asset.src), asset.src);
  }
});

test("a drag transaction is one undo step and redo preserves sticker geometry", () => {
  let state = createSession();
  const original = state.design;
  state = sessionReducer(state, { type: "design-begin" });
  for (let padding = 17; padding <= 30; padding++) state = sessionReducer(state, { type: "design", patch: { padding } });
  assert.equal(state.past.length, 0);
  state = sessionReducer(state, { type: "design-end" });
  assert.equal(state.past.length, 1);
  state = sessionReducer(state, { type: "undo" });
  assert.equal(state.design, original);
  state = sessionReducer(state, { type: "redo" });
  assert.equal(state.design.padding, 30);
});

test("design history is bounded, redo clears after a fresh edit, and photos are untouched", () => {
  let state = sessionReducer(createSession(), { type: "photo", index: 0, source: "blob:photo" });
  for (let padding = 0; padding < 40; padding++) state = sessionReducer(state, { type: "design", patch: { padding } });
  assert.equal(state.past.length, 30);
  state = sessionReducer(state, { type: "undo" });
  state = sessionReducer(state, { type: "design", patch: { borderColor: "#aabbcc" } });
  assert.equal(state.future.length, 0);
  assert.equal(state.images[0], "blob:photo");
});

test("undo retains custom sticker sources and invalid coordinates are clamped", () => {
  const sticker = normalizeSticker({ id: "one", src: "blob:sticker", name: "Custom", x: -8, y: Infinity, size: 12, rotation: 999, flipped: false });
  assert.equal(sticker.x, 0); assert.equal(sticker.y, .5); assert.equal(sticker.size, .8); assert.equal(sticker.rotation, 180);
  let state = sessionReducer(createSession(), { type: "design", patch: { stickers: [sticker] } });
  state = sessionReducer(state, { type: "design", patch: { stickers: [] } });
  assert.equal(state.past.at(-1).stickers[0].src, "blob:sticker");
  state = sessionReducer(state, { type: "undo" });
  assert.equal(state.design.stickers[0].src, "blob:sticker");
  const full = { ...createDesign(), stickers: Array(MAX_STICKERS).fill(sticker) };
  assert.equal(addSticker(full, sticker), full.stickers);
});

test("all filter presets preserve alpha and zero intensity restores neutral pixels", () => {
  for (const preset of photoFilters) {
    const pixels = new Uint8ClampedArray([180, 90, 30, 127]);
    applyFilterOperations(pixels, getFilterOperations({ ...defaultEffects(), preset: preset.id, intensity: 0 }));
    assert.deepEqual([...pixels], [180, 90, 30, 127]);
    applyFilterOperations(pixels, getFilterOperations({ ...defaultEffects(), preset: preset.id }));
    assert.equal(pixels[3], 127);
  }
});

test("pattern and frame decoration definitions have real SVG content", () => {
  for (const pattern of ["dots", "hearts", "stars", "stripes", "checker", "grid"]) assert.match(patternSvg(pattern, "#bb88dd"), /<svg/);
  for (const frame of ["film", "double", "inset", "postcard"]) assert.match(decorationSvg(frame, "#bb88dd"), /<svg/);
  assert.equal(patternSvg("none", "#bb88dd"), null);
});
