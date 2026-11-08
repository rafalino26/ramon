const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createDesign } = require("../.test-build/editor-design");
const {
  diffDesign,
  applyDesignChanges,
  inverseChanges,
  coalesceChanges,
} = require("../.test-build/room-design");
const sticker = (id) => ({
  id,
  src: "/stickers/cute/daisy.svg",
  name: "Daisy",
  x: 0.5,
  y: 0.5,
  size: 0.32,
  rotation: 0,
  flipped: false,
});

test("concurrent nested edits and separate sticker additions merge in either order", () => {
  const base = createDesign();
  const a = diffDesign(base, {
    ...base,
    caption: { ...base.caption, text: "Hello" },
    stickers: [sticker("a")],
  });
  const b = diffDesign(base, {
    ...base,
    caption: { ...base.caption, color: "#123456" },
    frame: "thin",
    stickers: [sticker("b")],
  });
  for (const batches of [
    [a, b],
    [b, a],
  ]) {
    const result = batches.reduce(applyDesignChanges, base);
    assert.equal(result.caption.text, "Hello");
    assert.equal(result.caption.color, "#123456");
    assert.equal(result.frame, "thin");
    assert.equal(result.stickers.length, 2);
  }
});

test("a stale sticker move cannot resurrect a deleted sticker, and layers preserve remote additions", () => {
  const base = { ...createDesign(), stickers: [sticker("a"), sticker("b")] };
  const move = diffDesign(base, {
    ...base,
    stickers: [{ ...sticker("a"), x: 0.8 }, sticker("b")],
  });
  const deleted = { ...base, stickers: [sticker("b")] };
  assert.deepEqual(applyDesignChanges(deleted, move).stickers, [sticker("b")]);
  const order = diffDesign(base, {
    ...base,
    stickers: [sticker("b"), sticker("a")],
  });
  assert.deepEqual(
    applyDesignChanges(
      { ...base, stickers: [...base.stickers, sticker("c")] },
      order,
    ).stickers.map((s) => s.id),
    ["b", "a", "c"],
  );
});

test("local undo preserves a partner property and a newer write to the same property", () => {
  const base = createDesign();
  const local = diffDesign(base, { ...base, padding: 20 });
  const remote = { ...base, padding: 20, gap: 12 };
  assert.equal(applyDesignChanges(remote, inverseChanges(local)).gap, 12);
  assert.equal(applyDesignChanges(remote, inverseChanges(local)).padding, 16);
  assert.equal(
    applyDesignChanges({ ...remote, padding: 24 }, inverseChanges(local))
      .padding,
    24,
  );
});

test("sticker undo compares JSON values independently of database object key ordering", () => {
  const base = createDesign(),
    added = { ...base, stickers: [sticker("a")] };
  const changes = diffDesign(base, added);
  const reordered = Object.fromEntries(Object.entries(sticker("a")).reverse());
  assert.equal(
    applyDesignChanges(
      { ...base, stickers: [reordered] },
      inverseChanges(changes),
    ).stickers.length,
    0,
  );
});

test("a transaction retains its first value and collapses add/remove to a no-op", () => {
  const base = createDesign();
  const first = diffDesign(base, { ...base, padding: 20 });
  const next = diffDesign({ ...base, padding: 20 }, { ...base, padding: 24 });
  assert.equal(coalesceChanges([...first, ...next])[0].before, 16);
  const added = { ...base, stickers: [sticker("a")] };
  assert.deepEqual(
    coalesceChanges([...diffDesign(base, added), ...diffDesign(added, base)]),
    [],
  );
});
