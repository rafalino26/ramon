const { test } = require("node:test");
const assert = require("node:assert/strict");
const { layouts, getSlotCount } = require("../.test-build/layout");
const { createSession, sessionReducer } = require("../.test-build/photobooth-session");

test("photos and empty positions survive tab changes and reselecting the same layout", () => {
  let session = createSession();
  session = sessionReducer(session, { type: "photo", index: 3, source: "blob:last-photo" });
  session = sessionReducer(session, { type: "tab", tab: "edit" });
  session = sessionReducer(session, { type: "tab", tab: "layout" });
  session = sessionReducer(session, { type: "layout", layout: session.layout });
  assert.deepEqual(session.images, [null, null, null, "blob:last-photo"]);
  assert.equal(session.hasSelectedLayout, true);
});

test("each layout change creates exactly its own empty slots", () => {
  for (const layout of layouts) {
    let session = createSession();
    session = sessionReducer(session, { type: "photo", index: 0, source: "blob:previous" });
    if (session.layout.id === layout.id) session = sessionReducer(session, { type: "reset" });
    session = sessionReducer(session, { type: "layout", layout });
    assert.equal(session.images.length, getSlotCount(layout));
    assert.ok(session.images.every((image) => image === null));
  }
});

test("invalid photo indexes cannot corrupt the session", () => {
  const original = createSession();
  for (const index of [-1, 99, 0.1, NaN]) {
    assert.equal(sessionReducer(original, { type: "photo", index, source: "bad" }), original);
  }
});

test("editor settings survive tab switches", () => {
  let session = sessionReducer(createSession(), { type: "design", patch: { frame: "polaroid" } });
  session = sessionReducer(session, { type: "design", patch: { borderColor: "#ff88aa" } });
  session = sessionReducer(session, { type: "tab", tab: "layout" });
  session = sessionReducer(session, { type: "tab", tab: "edit" });
  assert.equal(session.design.frame, "polaroid");
  assert.equal(session.design.borderColor, "#ff88aa");
});

test("reset and delete are immutable and keep layout and other slots", () => {
  const original = createSession();
  const first = sessionReducer(original, { type: "photo", index: 1, source: "one" });
  const second = sessionReducer(first, { type: "photo", index: 3, source: "two" });
  const deleted = sessionReducer(second, { type: "photo", index: 1, source: null });
  assert.equal(first.images[1], "one");
  assert.equal(original.images[1], null);
  assert.deepEqual(deleted.images, [null, null, null, "two"]);
  assert.deepEqual(sessionReducer(deleted, { type: "reset" }).images, original.images);
});
