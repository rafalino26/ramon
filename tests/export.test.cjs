const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getExportSize, coverCrop, prepareExport } = require("../.test-build/export");
const { setGlobal } = require("./helpers.cjs");

test("all portrait/landscape exports fit the shared iPad-safe canvas budget", () => {
  for (const [width, height] of [[384, 1536], [384, 128], [384, 384], [2000, 4000], [10000, 10000]]) {
    const size = getExportSize(width, height);
    assert.ok(size.width * size.height <= 4_000_000);
    assert.ok(Math.max(size.width, size.height) <= 4096);
    assert.ok(Math.abs(size.width / size.height - width / height) < 0.01);
  }
  assert.throws(() => getExportSize(0, 10));
});

test("export crops images to the actual rectangular preview slot", () => {
  assert.deepEqual(coverCrop(400, 300, 200, 100), { sx: 0, sy: 50, sw: 400, sh: 200 });
  assert.deepEqual(coverCrop(400, 300, 100, 200), { sx: 125, sy: 0, sw: 150, sh: 300 });
});

test("empty or mismatched photos never produce an export", async () => {
  const signal = new AbortController().signal;
  await assert.rejects(prepareExport({ slots: [] }, ["photo"], "white", signal), /out of sync/);
  await assert.rejects(prepareExport({ slots: [] }, [], "white", signal), /out of sync/);
});

test("a photo decoding failure rejects the whole export and releases canvas memory", async (t) => {
  const context = Object.fromEntries(["scale", "save", "beginPath", "moveTo", "arcTo", "closePath", "clip", "fillRect"]
    .map((key) => [key, () => {}]));
  let encoded = false;
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob: () => { encoded = true; } };
  setGlobal(t, "document", { createElement: () => canvas });
  setGlobal(t, "Image", class { set src(value) { if (value) this.onerror(); } });
  await assert.rejects(prepareExport({ width: 100, height: 100, radius: 0,
    slots: [{ x: 0, y: 0, width: 100, height: 100 }] }, ["broken"], "white", new AbortController().signal), /could not be loaded/);
  assert.equal(encoded, false);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});
