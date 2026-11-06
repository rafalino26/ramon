import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function arrange(page: Page, layout = "1 x 1", lastSlot = 0) {
  await page.goto("/photobooth");
  await page
    .getByRole("button", { name: `${layout} layout`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Upload photos", exact: true })
    .click();
  const pending = page.waitForEvent("filechooser");
  await page
    .locator("[data-upload-slot]")
    .nth(lastSlot)
    .getByRole("button")
    .click();
  await (
    await pending
  ).setFiles({
    name: "red.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><path fill="#ff0000" d="M0 0h800v600H0z"/></svg>',
    ),
  });
  await expect(page.getByAltText(`Uploaded ${lastSlot + 1}`)).toBeVisible();
  await page
    .getByRole("button", { name: "Make it yours", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "PNG", exact: true }),
  ).toBeEnabled();
}

async function downloadedPixels(page: Page, format = "PNG") {
  await expect(
    page.getByRole("button", { name: format, exact: true }),
  ).toBeEnabled();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: format, exact: true }).click();
  const download = await pending;
  return (await readFile((await download.path())!)).toString("base64");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "canShare", {
      value: () => false,
      configurable: true,
    }),
  );
});

test("editor controls stay reachable on a short phone", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium-phone");
  await page.setViewportSize({ width: 320, height: 568 });
  await arrange(page);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Caption", { exact: true }).fill("Lovely little day");
  await page.getByLabel("Caption", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Color", exact: true }).click();
  await page.getByRole("button", { name: "Petal pink", exact: true }).click();
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Nailong hati", exact: true })
    .click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator(".placed-sticker")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "PNG", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.locator(".editor-tabs").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("short-phone-editor.png") });
});

test("patterns, photo filters, captions and character stickers reach both export formats", async ({
  page,
}, info) => {
  await arrange(page);
  await page.getByRole("button", { name: "Color", exact: true }).click();
  await page.getByRole("button", { name: "Soft lilac", exact: true }).click();
  await page.getByRole("button", { name: "hearts", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "B&W", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Caption", { exact: true }).fill("Our little moment");
  await page.getByLabel("Caption", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page
    .getByRole("button", { name: "Add Nailong bunga", exact: true })
    .click();
  const sticker = page.locator(".placed-sticker img");
  await expect(sticker).toBeVisible();
  await expect
    .poll(() =>
      sticker.evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const geometry = await page
    .locator('[data-testid="photostrip"]')
    .evaluate((frame) => {
      const box = frame.getBoundingClientRect();
      const slot = frame
        .querySelector("[data-photo-slot]")!
        .getBoundingClientRect();
      const caption = frame
        .querySelector("[data-caption]")!
        .getBoundingClientRect();
      return {
        aspect: box.width / box.height,
        photoX: (slot.x + slot.width / 2 - box.x) / box.width,
        photoY: (slot.y + slot.height * 0.2 - box.y) / box.height,
        captionTop: (caption.top - box.top) / box.height,
        captionBottom: (caption.bottom - box.top) / box.height,
      };
    });
  for (const format of ["PNG", "JPG"]) {
    const data = await downloadedPixels(page, format);
    const result = await page.evaluate(
      async ({ data, geometry, format }) => {
        const image = new Image();
        image.src = `data:image/${format === "PNG" ? "png" : "jpeg"};base64,${data}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const at = (x: number, y: number) =>
          Array.from(
            pixels.slice(
              (Math.floor(y * canvas.height) * canvas.width +
                Math.floor(x * canvas.width)) *
                4,
              (Math.floor(y * canvas.height) * canvas.width +
                Math.floor(x * canvas.width)) *
                4 +
                4,
            ),
          );
        let yellow = 0,
          letters = 0;
        for (let y = 0; y < canvas.height; y += 2)
          for (let x = 0; x < canvas.width; x += 2) {
            const i = (y * canvas.width + x) * 4;
            if (
              x / canvas.width > 0.2 &&
              x / canvas.width < 0.65 &&
              y / canvas.height > 0.45 &&
              y / canvas.height < 0.85 &&
              pixels[i] > 180 &&
              pixels[i + 1] > 140 &&
              pixels[i + 2] < 110
            )
              yellow++;
            if (
              y / canvas.height > geometry.captionTop &&
              y / canvas.height < geometry.captionBottom &&
              pixels[i] < 170 &&
              pixels[i + 1] < 140 &&
              pixels[i + 2] < 190
            )
              letters++;
          }
        const borderColors = new Set<string>();
        for (let y = 0.03; y < 0.95; y += 0.01)
          borderColors.add(at(0.025, y).join(","));
        return {
          aspect: canvas.width / canvas.height,
          photo: at(geometry.photoX, geometry.photoY),
          yellow,
          letters,
          borderColors: borderColors.size,
        };
      },
      { data, geometry, format },
    );
    expect(result.aspect).toBeCloseTo(geometry.aspect, 2);
    expect(Math.abs(result.photo[0] - result.photo[1])).toBeLessThan(4);
    expect(Math.abs(result.photo[1] - result.photo[2])).toBeLessThan(4);
    expect(result.photo[0]).toBeGreaterThan(30);
    expect(result.yellow).toBeGreaterThan(100);
    expect(result.letters).toBeGreaterThan(50);
    expect(result.borderColors).toBeGreaterThan(2);
  }
  await page.screenshot({
    path: info.outputPath("custom-editor.png"),
    fullPage: true,
  });
});

test("custom sticker layers keep transparency, transforms and undo history across tabs", async ({
  page,
}, info) => {
  await arrange(page);
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 100;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(10, 10, 80, 80);
    return canvas.toDataURL().split(",")[1];
  });
  const pending = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Upload sticker", exact: true })
    .click();
  await (
    await pending
  ).setFiles({
    name: "mint.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.locator(".placed-sticker")).toHaveCount(1);
  const source = await page.locator(".placed-sticker img").getAttribute("src");
  const placed = page.locator(".placed-sticker");
  const startLeft = await placed.evaluate((element) => element.style.left);
  const box = await placed.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 20,
    box!.y + box!.height / 2 - 10,
    { steps: 4 },
  );
  await page.mouse.up();
  await expect
    .poll(() => placed.evaluate((element) => element.style.left))
    .not.toBe(startLeft);
  await page
    .getByRole("button", { name: "Undo design change", exact: true })
    .click();
  await expect
    .poll(() => placed.evaluate((element) => element.style.left))
    .toBe(startLeft);
  await page
    .getByLabel("Sticker rotation", { exact: true })
    .press("ArrowRight");
  await expect(page.locator(".placed-sticker")).toHaveCSS(
    "transform",
    /matrix/,
  );
  await page.getByRole("button", { name: "Flip", exact: true }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.locator(".placed-sticker")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Delete selected sticker", exact: true })
    .click();
  await expect(page.locator(".placed-sticker")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Undo design change", exact: true })
    .click();
  await expect(page.locator(".placed-sticker")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Redo design change", exact: true })
    .click();
  await expect(page.locator(".placed-sticker")).toHaveCount(1);
  await page.getByRole("button", { name: "Layout", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.locator(".placed-sticker img")).toHaveAttribute(
    "src",
    source!,
  );
  await expect
    .poll(() =>
      page
        .locator(".placed-sticker img")
        .evaluate((img) => (img as HTMLImageElement).naturalWidth),
    )
    .toBe(100);
  const data = await downloadedPixels(page);
  const pixel = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    return Array.from(
      ctx.getImageData(
        Math.floor(canvas.width * 0.42),
        Math.floor(canvas.height * 0.65),
        1,
        1,
      ).data,
    );
  }, data);
  expect(pixel).toEqual([0, 255, 0, 255]);
  await page.screenshot({
    path: info.outputPath("custom-sticker.png"),
    fullPage: true,
  });
});

test("extra frame styles, patterns, Stitch and SVG stickers remain downloadable", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await arrange(page);
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page.getByRole("button", { name: "Stitch", exact: true }).click();
  const thumbnailsFit = await page
    .locator(".sticker-catalog button")
    .evaluateAll((buttons) =>
      buttons.every((button) => {
        const box = button.getBoundingClientRect();
        const image = button.querySelector("img")!.getBoundingClientRect();
        return (
          image.left >= box.left &&
          image.top >= box.top &&
          image.right <= box.right &&
          image.bottom <= box.bottom
        );
      }),
    );
  expect(thumbnailsFit).toBe(true);
  await page
    .getByRole("button", { name: "Add Stitch blue 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Cute", exact: true }).click();
  await page
    .getByRole("button", { name: "Add purple heart", exact: true })
    .click();
  await expect(page.locator(".placed-sticker")).toHaveCount(2);
  for (const [frame, pattern] of [
    ["Film", "dots"],
    ["Postcard", "stars"],
    ["Double", "stripes"],
    ["Inset", "checker"],
    ["Rounded", "grid"],
    ["Thin", "hearts"],
  ]) {
    await page.getByRole("button", { name: "Frame", exact: true }).click();
    await page.getByRole("button", { name: frame, exact: true }).click();
    await page.getByRole("button", { name: "Color", exact: true }).click();
    await page.getByRole("button", { name: pattern, exact: true }).click();
    const data = await downloadedPixels(page);
    expect(Buffer.from(data, "base64").length).toBeGreaterThan(10_000);
    await expect(page.locator(".notice-error")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page.locator(".editor-tabs").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("stitch-cute-editor.png") });
});

test("creative, portrait and larger grids export their last slot without distortion", async ({
  page,
}) => {
  test.setTimeout(180_000);
  for (const [layout, count] of [
    ["Spotlight", 3],
    ["Side story", 3],
    ["Memory mosaic", 6],
    ["Panorama mix", 3],
    ["Portrait solo", 1],
    ["6 x 1", 6],
    ["3 x 3", 9],
  ] as const) {
    await arrange(page, layout, count - 1);
    await expect(page.locator("[data-photo-slot]")).toHaveCount(count);
    const geometry = await page
      .locator('[data-testid="photostrip"]')
      .evaluate((frame) => {
        const box = frame.getBoundingClientRect();
        const slot = frame
          .querySelector("[data-photo-slot]:last-child")!
          .getBoundingClientRect();
        return {
          aspect: box.width / box.height,
          x: (slot.x + slot.width / 2 - box.x) / box.width,
          y: (slot.y + slot.height / 2 - box.y) / box.height,
        };
      });
    const data = await downloadedPixels(page);
    const result = await page.evaluate(
      async ({ data, geometry }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0);
        return {
          aspect: canvas.width / canvas.height,
          pixel: Array.from(
            ctx.getImageData(
              Math.floor(canvas.width * geometry.x),
              Math.floor(canvas.height * geometry.y),
              1,
              1,
            ).data,
          ),
        };
      },
      { data, geometry },
    );
    expect(result.aspect).toBeCloseTo(geometry.aspect, 2);
    expect(result.pixel[0]).toBeGreaterThan(240);
    expect(result.pixel[1]).toBeLessThan(10);
    expect(result.pixel[2]).toBeLessThan(10);
    expect(result.pixel[3]).toBe(255);
  }
});

test("elliptical photo corners match the preview on portrait and wide slots", async ({
  page,
}) => {
  for (const layout of ["Portrait solo", "Wide pair"]) {
    await arrange(page, layout);
    await page
      .getByRole("button", { name: "circle photo shape", exact: true })
      .click();
    const geometry = await page
      .locator('[data-testid="photostrip"]')
      .evaluate((frame) => {
        const box = frame.getBoundingClientRect();
        const slot = frame
          .querySelector("[data-photo-slot]")!
          .getBoundingClientRect();
        const portrait = slot.height > slot.width;
        return {
          outsideX:
            (slot.x - box.x + slot.width * (portrait ? 0.1 : 0.17)) / box.width,
          outsideY:
            (slot.y - box.y + slot.height * (portrait ? 0.17 : 0.1)) /
            box.height,
          centerX: (slot.x - box.x + slot.width / 2) / box.width,
          centerY: (slot.y - box.y + slot.height / 2) / box.height,
        };
      });
    const data = await downloadedPixels(page);
    const pixels = await page.evaluate(
      async ({ data, geometry }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const sample = (x: number, y: number) =>
          Array.from(
            context.getImageData(
              Math.floor(x * canvas.width),
              Math.floor(y * canvas.height),
              1,
              1,
            ).data,
          );
        return {
          outside: sample(geometry.outsideX, geometry.outsideY),
          center: sample(geometry.centerX, geometry.centerY),
        };
      },
      { data, geometry },
    );
    expect(pixels.outside).toEqual([255, 255, 255, 255]);
    expect(pixels.center[0]).toBeGreaterThan(240);
    expect(pixels.center[1]).toBeLessThan(10);
    expect(pixels.center[2]).toBeLessThan(10);
  }
});

test("photo adjustments export even when canvas filters are unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    delete (
      CanvasRenderingContext2D.prototype as Partial<CanvasRenderingContext2D>
    ).filter;
  });
  await arrange(page);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page.getByRole("button", { name: "B&W", exact: true }).click();
  const data = await downloadedPixels(page);
  const pixel = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    return Array.from(
      ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data,
    );
  }, data);
  expect(Math.abs(pixel[0] - pixel[1])).toBeLessThan(2);
  expect(Math.abs(pixel[1] - pixel[2])).toBeLessThan(2);
  expect(pixel[0]).toBeGreaterThan(30);
  expect(pixel[0]).toBeLessThan(90);
});
