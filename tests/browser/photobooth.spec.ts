import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument, PDFDict, PDFName, PDFRawStream } from "pdf-lib";

const photo = (color: string) => ({
  name: "photo.svg",
  mimeType: "image/svg+xml",
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><path fill="${color}" d="M0 0h800v600H0z"/></svg>`,
  ),
});

test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "webkit-ipad-desktop") {
    // Playwright's touch emulation reports one point; real iPads report multiple.
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "maxTouchPoints", {
        value: 5,
        configurable: true,
      }),
    );
  }
});

async function arrange(
  page: Page,
  layout = "2 x 2",
  index = 0,
  color = "#ff0000",
) {
  await page.goto("/photobooth");
  await page.getByText(layout, { exact: true }).click();
  await page.getByRole("button", { name: "Upload photos" }).click();
  const upload = page.waitForEvent("filechooser");
  // Empty upload slots are the only buttons inside this grid.
  await page
    .locator("[data-upload-slot]")
    .nth(index)
    .getByRole("button")
    .click();
  await (await upload).setFiles(photo(color));
  await expect(page.getByAltText(`Uploaded ${index + 1}`)).toBeVisible();
  await page.getByRole("button", { name: "Make it yours" }).click();
  await expect(
    page.getByRole("button", { name: "PNG", exact: true }),
  ).toBeEnabled();
}

async function readPixels(
  page: Page,
  path: string,
  type: string,
  x = 0.5,
  y = 0.5,
) {
  const data = (await readFile(path)).toString("base64");
  return page.evaluate(
    async ({ data, type, x, y }) => {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = `data:${type};base64,${data}`;
      });
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        pixel: Array.from(
          context.getImageData(
            Math.floor(canvas.width * x),
            Math.floor(canvas.height * y),
            1,
            1,
          ).data,
        ),
      };
    },
    { data, type, x, y },
  );
}

test("uploaded photos reach the correct editor slot and survive tab switches", async ({
  page,
}) => {
  await arrange(page, "2 x 2", 3);
  await expect(page.locator("[data-photo-slot='0'] img")).toHaveCount(0);
  await expect(page.locator("[data-photo-slot='3'] img")).toBeVisible();
  const source = await page
    .locator("[data-photo-slot='3'] img")
    .getAttribute("src");
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator("[data-photo-slot='3'] img")).toHaveAttribute(
    "src",
    source!,
  );
});

test("PNG and JPEG downloads contain photo pixels with matching preview proportions", async ({
  page,
}) => {
  // Exercise the ordinary anchor fallback on every browser engine.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    }),
  );
  await arrange(page, "1 x 1");
  for (const [button, mime] of [
    ["PNG", "image/png"],
    ["JPG", "image/jpeg"],
  ]) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: button, exact: true }).click();
    const download = await pending;
    const result = await readPixels(page, (await download.path())!, mime);
    expect(result.pixel[0]).toBeGreaterThan(240);
    expect(result.pixel[1]).toBeLessThan(20);
    expect(result.pixel[2]).toBeLessThan(20);
    expect(result.width).toBe(result.height);
    expect(result.width * result.height).toBeLessThanOrEqual(4_000_000);
  }
});

test("all frame exports preserve preview geometry and circle corners are transparent", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    }),
  );
  await arrange(page, "1 x 1");
  for (const preset of ["Thin", "Rounded", "Polaroid", "Circle"]) {
    await page.getByRole("button", { name: preset, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "PNG", exact: true }),
    ).toBeEnabled();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG", exact: true }).click();
    const download = await pending;
    const result = await readPixels(
      page,
      (await download.path())!,
      "image/png",
      0,
      0,
    );
    if (preset === "Circle" || preset === "Rounded")
      expect(result.pixel[3]).toBe(0);
    else expect(result.pixel[3]).toBe(255);
  }
});

test("color changes reach the exported border and survive tab switches", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    }),
  );
  await arrange(page, "1 x 1");
  await page.getByRole("button", { name: "Color", exact: true }).click();
  await page.getByLabel("Hex", { exact: true }).fill("00ff00");
  await page.getByLabel("Hex", { exact: true }).press("Tab");
  const preview = page.locator("[data-photo-slot='0']").locator("../..");
  await expect(preview).toHaveCSS("background-color", "rgb(0, 255, 0)");
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(preview).toHaveCSS("background-color", "rgb(0, 255, 0)");
  await expect(
    page.getByRole("button", { name: "PNG", exact: true }),
  ).toBeEnabled();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG", exact: true }).click();
  const download = await pending;
  const result = await readPixels(
    page,
    (await download.path())!,
    "image/png",
    0.01,
    0.5,
  );
  expect(result.pixel[0]).toBeLessThan(20);
  expect(result.pixel[1]).toBeGreaterThan(240);
  expect(result.pixel[2]).toBeLessThan(20);
});

test("layout changes discard incompatible photos", async ({ page }) => {
  await arrange(page);
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByText("1 x 1", { exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByText("No photos just yet.")).toBeVisible();
});

test("all eight layouts export without dropping empty slot positions", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    }),
  );
  for (const [rows, cols] of [
    [4, 1],
    [3, 1],
    [2, 1],
    [3, 2],
    [1, 2],
    [2, 3],
    [2, 2],
    [1, 1],
  ]) {
    await arrange(page, `${rows} x ${cols}`, rows * cols - 1);
    const preview = await page
      .locator("[data-photo-slot='0']")
      .locator("../..")
      .boundingBox();
    const slot = await page
      .locator(`[data-photo-slot='${rows * cols - 1}']`)
      .boundingBox();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "PNG", exact: true }).click();
    const download = await pending;
    const result = await readPixels(
      page,
      (await download.path())!,
      "image/png",
      (slot!.x + slot!.width / 2 - preview!.x) / preview!.width,
      (slot!.y + slot!.height / 2 - preview!.y) / preview!.height,
    );
    expect(result.pixel[0]).toBeGreaterThan(240);
    expect(result.pixel[1]).toBeLessThan(20);
    expect(result.width / result.height).toBeCloseTo(
      preview!.width / preview!.height,
      2,
    );
  }
});

test("replacing a layout releases its photo object URLs", async ({ page }) => {
  await page.addInitScript(() => {
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      const previous = JSON.parse(
        document.documentElement.dataset.revokedUrls ?? "[]",
      ) as string[];
      document.documentElement.dataset.revokedUrls = JSON.stringify([
        ...previous,
        url,
      ]);
      revoke(url);
    };
  });
  await arrange(page, "1 x 1");
  const source = await page
    .locator("[data-photo-slot='0'] img")
    .getAttribute("src");
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByText("2 x 2", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-revoked-urls",
    new RegExp(source!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});

test("iPad native share receives prepared image and PDF files synchronously without downloading after cancel", async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith("webkit"));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: (data: ShareData) => {
        document.documentElement.dataset.sharedFile = data.files![0].type;
        document.documentElement.dataset.shareActivation = String(
          navigator.userActivation?.isActive,
        );
        return Promise.reject(new DOMException("Canceled", "AbortError"));
      },
      configurable: true,
    });
  });
  const downloads: string[] = [];
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );
  await arrange(page, "1 x 1");
  for (const [button, mime] of [
    ["PNG", "image/png"],
    ["PDF", "application/pdf"],
  ]) {
    await expect(
      page.getByRole("button", { name: button, exact: true }),
    ).toBeEnabled({ timeout: 15000 });
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-shared-file",
      mime,
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-share-activation",
      "true",
    );
    await expect(
      page.getByRole("button", { name: button, exact: true }),
    ).toBeEnabled();
  }
  expect(downloads).toEqual([]);
});

for (const layout of ["2 x 2", "4 x 1", "1 x 4"]) {
  test(`PDF preserves all rendered artwork on an oriented A4 page for ${layout}`, async ({
    page,
  }, info) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "canShare", {
        value: () => false,
        configurable: true,
      }),
    );
    await arrange(page, layout);
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("Caption", { exact: true }).fill("Our little memory");
    await page.getByLabel("Caption", { exact: true }).press("Tab");
    await page.getByRole("button", { name: "Stickers", exact: true }).click();
    await page.locator(".sticker-catalog button").first().click();
    if (layout === "1 x 4")
      await page.getByLabel("Sticker size", { exact: true }).press("Home");
    await expect(
      page.getByRole("button", { name: "PDF", exact: true }),
    ).toBeEnabled({ timeout: 15000 });
    const jpegPending = page.waitForEvent("download");
    await page.getByRole("button", { name: "JPG", exact: true }).click();
    const jpeg = await readFile((await (await jpegPending).path())!);
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("ramon-photobooth.pdf");
    const path = info.outputPath("photobooth.pdf");
    await download.saveAs(path);
    const document = await PDFDocument.load(await readFile(path));
    expect(document.getPageCount()).toBe(1);
    const pageSize = document.getPage(0).getSize();
    expect(pageSize.width > pageSize.height).toBe(layout === "1 x 4");
    const resources = document
      .getPage(0)
      .node.Resources()!
      .lookup(PDFName.of("XObject"), PDFDict);
    const images = resources.values().map((value) => {
      const object = document.context.lookup(value);
      if (!(object instanceof PDFRawStream))
        throw new Error("Expected an embedded image stream.");
      return object;
    });
    expect(images).toHaveLength(1);
    expect(Buffer.from(images[0].getContents()).equals(jpeg)).toBe(true);
  });
}

test("WebP download has real WebP bytes, photo pixels, and transparent frame corners", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    }),
  );
  const supported = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        canvas.toBlob(
          (blob) => resolve(blob?.type === "image/webp"),
          "image/webp",
        );
      }),
  );
  test.skip(!supported, "This browser does not encode WebP.");
  await arrange(page, "1 x 1");
  await expect(
    page.getByRole("button", { name: "WebP", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "WebP", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("ramon-photobooth.webp");
  const path = (await download.path())!,
    bytes = await readFile(path);
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  const center = await readPixels(page, path, "image/webp");
  expect(center.pixel[0]).toBeGreaterThan(235);
  expect(center.pixel[1]).toBeLessThan(25);
  const corner = await readPixels(page, path, "image/webp", 0, 0);
  expect(corner.pixel[3]).toBe(0);
});

test("camera reset cancels countdown and leaving the tab stops the stream", async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith("chromium"));
  await page.addInitScript(() =>
    Reflect.deleteProperty(CanvasRenderingContext2D.prototype, "filter"),
  );
  await page.goto("/photobooth");
  await page.getByText("1 x 1", { exact: true }).click();
  await page.getByRole("button", { name: "Use camera" }).click();
  await expect(page.getByRole("button", { name: "Capture (0/1)" })).toBeEnabled();
  const video = page.locator("video");
  await expect(video).toHaveCSS("transform", "matrix(-1, 0, 0, 1, 0, 0)");
  await page.getByRole("button", { name: "Mirror camera", exact: true }).click();
  await expect(video).toHaveCSS("transform", "none");
  const streamId = await video.evaluate(el => ((el as HTMLVideoElement).srcObject as MediaStream).id);
  await page.getByRole("button", { name: "Focus camera", exact: true }).click();
  await expect(page.locator(".camera-focus-mode")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Exit camera focus", exact: true }).click();
  await expect(page.locator(".camera-focus-mode")).toHaveCount(0);
  await page.getByRole("button", { name: "Focus camera", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".camera-focus-mode")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  expect(await video.evaluate(el => ((el as HTMLVideoElement).srcObject as MediaStream).id)).toBe(streamId);
  await expect(
    page.getByRole("button", { name: "Capture (0/1)" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Wide view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Capture (0/1)" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Capture (0/1)" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "3s", exact: true }).click();
  await page.getByRole("button", { name: "Capture (0/1)" }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Capture (0/1)" }),
  ).toBeEnabled();
  // A canceled timer must not inject a photo after its original deadline.
  await page.waitForTimeout(3100);
  await expect(page.getByAltText("Capture 1")).toHaveCount(0);
  await page.getByRole("button", { name: "B&W", exact: true }).click();
  await page.getByRole("button", { name: "Capture (0/1)" }).click();
  await expect(
    page.getByRole("button", { name: "Make it yours" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const video = document.querySelector("video")!;
    const stream = video.srcObject as MediaStream;
    stream.getTracks().forEach((track) =>
      track.addEventListener("ended", () => {
        document.documentElement.dataset.trackEnded = "true";
      }),
    );
    const stop = stream.getTracks()[0].stop.bind(stream.getTracks()[0]);
    stream.getTracks()[0].stop = () => {
      document.documentElement.dataset.trackEnded = "true";
      stop();
    };
  });
  await page.getByRole("button", { name: "Make it yours" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-track-ended",
    "true",
  );
  await expect(page.locator("[data-photo-slot='0'] img")).toBeVisible();
  const largestChannelDifference = await page
    .locator("[data-photo-slot='0'] img")
    .evaluate(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let largest = 0;
      for (let index = 0; index < data.length; index += 400) {
        largest = Math.max(
          largest,
          Math.abs(data[index] - data[index + 1]),
          Math.abs(data[index + 1] - data[index + 2]),
        );
      }
      return largest;
    });
  expect(largestChannelDifference).toBeLessThan(8);
});

test("quick captions, custom export names and image clipboard work together", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { value: () => false, configurable: true });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      write: async (items: ClipboardItem[]) => {
        document.documentElement.dataset.copyActivation = String(navigator.userActivation.isActive);
        const blob = await items[0].getType("image/png");
        document.documentElement.dataset.copyBytes = String(blob.size);
      },
    } });
  });
  await arrange(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Better together", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Caption", exact: true })).toHaveValue("Better together");
  await page.getByRole("button", { name: "Today’s date", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Caption", exact: true })).not.toHaveValue("Better together");
  await page.getByRole("textbox", { name: "File name", exact: true }).fill("Our memory.jpg");
  await page.getByRole("button", { name: "Copy image", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Image copied" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-copy-activation", "true");
  expect(Number(await page.locator("html").getAttribute("data-copy-bytes"))).toBeGreaterThan(1000);
  for (const format of ["PNG", "PDF"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: format, exact: true }).click();
    expect((await download).suggestedFilename()).toBe(`Our memory.${format.toLowerCase()}`);
  }
});
