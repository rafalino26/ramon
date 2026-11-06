const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isAppleMobile, saveFile } = require("../.test-build/download");
const { setGlobal } = require("./helpers.cjs");

test("iPad desktop user agent uses Apple handoff while a Mac does not", () => {
  assert.equal(isAppleMobile({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", maxTouchPoints: 5 }), true);
  assert.equal(isAppleMobile({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", maxTouchPoints: 0 }), false);
  assert.equal(isAppleMobile({ userAgent: "iPhone", maxTouchPoints: 1 }), true);
  assert.equal(isAppleMobile({ userAgent: "Windows", maxTouchPoints: 5 }), false);
});

function environment(t, share) {
  const calls = [];
  setGlobal(t, "navigator", {
    userAgent: "iPad", maxTouchPoints: 5, canShare: () => true, share,
  });
  setGlobal(t, "document", {
    createElement: () => ({ click: () => calls.push("download"), remove() {} }),
    body: { appendChild() {} },
  });
  setGlobal(t, "window", { setTimeout: () => 1 });
  return calls;
}

test("native share starts synchronously before any await loses user activation", async (t) => {
  let called = false;
  environment(t, async () => { called = true; });
  const saving = saveFile(new File(["photo"], "photo.png", { type: "image/png" }));
  assert.equal(called, true);
  await saving;
});

test("canceling share never starts an unwanted download", async (t) => {
  const calls = environment(t, async () => { throw new DOMException("Canceled", "AbortError"); });
  await saveFile(new File(["photo"], "photo.png", { type: "image/png" }));
  assert.deepEqual(calls, []);
});

test("failed or unsupported native share falls back to the same real file", async (t) => {
  const calls = environment(t, async () => { throw new Error("Unavailable"); });
  await saveFile(new File(["photo"], "photo.png", { type: "image/png" }));
  assert.deepEqual(calls, ["download"]);
});
