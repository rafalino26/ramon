const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  getPdfPlacement,
  preparePdfFile,
  prepareWebpFile,
} = require("../.test-build/extra-exports");
const { setGlobal } = require("./helpers.cjs");

test("PDF artwork fits one oriented A4 page with margins and unchanged proportions", () => {
  for (const [width, height] of [
    [2000, 2000],
    [400, 4096],
    [4096, 400],
  ]) {
    const page = getPdfPlacement(width, height);
    assert.equal(page.pageWidth > page.pageHeight, width > height);
    assert.ok(Math.abs(page.width / page.height - width / height) < 0.000001);
    assert.ok(page.x >= 23.99 && page.y >= 23.99);
    assert.ok(page.x + page.width <= page.pageWidth - 23.99);
    assert.ok(page.y + page.height <= page.pageHeight - 23.99);
  }
  assert.throws(() => getPdfPlacement(0, 20));
  assert.throws(() => getPdfPlacement(NaN, 20));
});

test("unsupported WebP encoders cannot produce a PNG with a WebP filename", async (t) => {
  let requested;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage() {} }),
    toBlob(callback, type, quality) {
      requested = { type, quality };
      callback(new Blob(["PNG fallback"], { type: "image/png" }));
    },
  };
  setGlobal(t, "document", { createElement: () => canvas });
  setGlobal(
    t,
    "Image",
    class {
      naturalWidth = 100;
      naturalHeight = 200;
      set src(value) {
        if (value) this.onload();
      }
    },
  );
  const result = await prepareWebpFile(
    new File(["png"], "photo.png", { type: "image/png" }),
    new AbortController().signal,
  );
  assert.equal(result, null);
  assert.deepEqual(requested, { type: "image/webp", quality: 0.92 });
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test("canceled extra exports stop before creating any file", async () => {
  const controller = new AbortController();
  controller.abort();
  const file = new File(["image"], "image.jpg", { type: "image/jpeg" });
  await assert.rejects(preparePdfFile(file, controller.signal), {
    name: "AbortError",
  });
  await assert.rejects(prepareWebpFile(file, controller.signal), {
    name: "AbortError",
  });
});

test("invalid JPEG data cannot produce a successful PDF download", async () => {
  await assert.rejects(
    preparePdfFile(
      new File(["invalid"], "photo.jpg", { type: "image/jpeg" }),
      new AbortController().signal,
    ),
  );
});
