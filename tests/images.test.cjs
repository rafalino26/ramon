const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fitPhotoSize, isHeic, loadImage, canvasToBlob } = require("../.test-build/images");
const { applyPixelFilter } = require("../.test-build/camera");
const { setGlobal } = require("./helpers.cjs");

test("phone photos are bounded without upscaling or changing orientation", () => {
  assert.deepEqual(fitPhotoSize(4032, 3024), { width: 1920, height: 1440 });
  assert.deepEqual(fitPhotoSize(3024, 4032), { width: 1440, height: 1920 });
  assert.deepEqual(fitPhotoSize(640, 480), { width: 640, height: 480 });
  assert.throws(() => fitPhotoSize(0, 100));
});

test("HEIC detection handles missing MIME and sequence types", () => {
  assert.equal(isHeic({ name: "IMG.HEIC", type: "" }), true);
  assert.equal(isHeic({ name: "photo", type: "image/heif-sequence" }), true);
  assert.equal(isHeic({ name: "photo.jpg", type: "image/jpeg" }), false);
});

test("Safari fallback filters modify pixels while preserving alpha", () => {
  for (const filter of ["b&w", "vintage", "vivid", "cool", "warm"]) {
    const pixels = new Uint8ClampedArray([180, 90, 30, 255]);
    applyPixelFilter(pixels, filter);
    assert.equal(pixels[3], 255);
    assert.notDeepEqual([...pixels], [180, 90, 30, 255]);
    if (filter === "b&w") assert.equal(pixels[0], pixels[1]);
  }
});

test("cached images load even when src setter invokes onload immediately", async (t) => {
  class ImmediateImage {
    naturalWidth = 10;
    naturalHeight = 20;
    set src(value) { if (value) this.onload(); }
  }
  setGlobal(t, "Image", ImmediateImage);
  const image = await loadImage("blob:test");
  assert.equal(image.naturalWidth, 10);
});

test("loadImage rejects failed and canceled images", async (t) => {
  class FailedImage { set src(value) { if (value) this.onerror(); } }
  setGlobal(t, "Image", FailedImage);
  await assert.rejects(loadImage("broken"), /could not be loaded/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(loadImage("canceled", controller.signal), { name: "AbortError" });
});

test("encoding failure rejects instead of generating a blank success", async () => {
  await assert.rejects(canvasToBlob({ toBlob(callback) { callback(null); } }, "image/png"), /Unable to encode/);
});
