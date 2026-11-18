const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cropGeometry, initialPhotoCrop } = require("../.test-build/photo-crop");
const { createSession, sessionReducer } = require("../.test-build/photobooth-session");
const { restoreLocalDraft } = require("../.test-build/local-draft");

test("photo crop pans inside source bounds and swaps dimensions for quarter turns", () => {
  const left = cropGeometry(900, 600, 1, { ...initialPhotoCrop, panX: -1 });
  const right = cropGeometry(900, 600, 1, { ...initialPhotoCrop, panX: 1 });
  assert.equal(left.sx, 0);
  assert.equal(right.sx, 300);
  assert.equal(right.sw, 600);
  const rotated = cropGeometry(900, 600, 1, { ...initialPhotoCrop, rotation: 90, panY: 1, zoom: 3 });
  assert.equal(rotated.rotatedWidth, 600);
  assert.equal(rotated.rotatedHeight, 900);
  assert.equal(rotated.sh, 200);
  assert.equal(rotated.sy, 700);
});

test("photo adjustment undo preserves styling and newer captures", () => {
  let session = sessionReducer(createSession(), { type: "photo", index: 0, source: "blob:original" });
  session = sessionReducer(session, { type: "edit-photo", index: 0, source: "blob:crop", expected: "blob:original" });
  session = sessionReducer(session, { type: "design", patch: { borderColor: "#ff0000" } });
  session = sessionReducer(session, { type: "undo" });
  assert.equal(session.images[0], "blob:crop");
  session = sessionReducer(session, { type: "undo" });
  assert.equal(session.images[0], "blob:original");
  session = sessionReducer(session, { type: "redo" });
  assert.equal(session.images[0], "blob:crop");
  session = sessionReducer(session, { type: "photo", index: 0, source: "blob:new-capture" });
  session = sessionReducer(session, { type: "undo" });
  assert.equal(session.images[0], "blob:new-capture");
});

test("draft restoration rebuilds shared blob references and rejects missing files before allocating URLs", () => {
  const session = createSession();
  const draft = {
    version: 1, savedAt: 1, layoutId: session.layout.id,
    images: ["blob:photo", null, null, null],
    design: { ...session.design, stickers: [{ id: "custom", src: "blob:photo", name: "Custom", x: 0.5, y: 0.5, size: 0.2, rotation: 0, flipped: false }] },
    blobs: { "blob:photo": { bytes: new TextEncoder().encode("image").buffer, type: "image/png" } },
  };
  let allocated = 0;
  const restored = restoreLocalDraft(draft, () => `blob:restored-${++allocated}`);
  assert.equal(allocated, 1);
  assert.equal(restored.images[0], restored.design.stickers[0].src);
  assert.equal(restored.tab, "edit");
  assert.throws(() => restoreLocalDraft({ ...draft, blobs: {} }, () => { allocated++; }), /missing/);
  assert.equal(allocated, 1);
});
