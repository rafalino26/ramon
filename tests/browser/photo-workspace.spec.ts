import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const photo = {
  name: "colours.svg", mimeType: "image/svg+xml",
  buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><path fill="red" d="M0 0h300v600H0z"/><path fill="lime" d="M300 0h300v600H300z"/><path fill="blue" d="M600 0h300v600H600z"/></svg>'),
};

async function arrange(page: Page) {
  await page.goto("/photobooth");
  await page.getByRole("button", { name: "2 x 2 layout", exact: true }).click();
  await page.getByRole("button", { name: "Upload photos", exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("[data-upload-slot]").first().getByRole("button").click();
  await (await chooser).setFiles(photo);
  await page.getByRole("button", { name: "Make it yours", exact: true }).click();
  await expect(page.getByRole("button", { name: "PNG", exact: true })).toBeEnabled();
}

test("photo crop, mobile shortcuts and local draft recovery preserve photos and custom art", async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 664 });
  await arrange(page);
  const original = await page.locator("[data-photo-slot='0'] img").getAttribute("src");
  await page.getByRole("button", { name: "Adjust photo 1", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Adjust photo 1", exact: true });
  await expect(dialog).toBeVisible();
  await page.getByRole("slider", { name: "Photo zoom", exact: true }).press("End");
  await page.getByRole("slider", { name: "Photo horizontal position", exact: true }).press("End");
  await page.getByRole("button", { name: "Rotate photo right", exact: true }).click();
  await page.getByRole("button", { name: "Rotate photo left", exact: true }).click();
  await page.getByRole("slider", { name: "Photo horizontal position", exact: true }).press("End");
  await page.getByRole("button", { name: "Apply photo edit", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const image = page.locator("[data-photo-slot='0'] img");
  await expect(image).not.toHaveAttribute("src", original!);
  const cropped = await image.getAttribute("src");
  const pixel = await image.evaluate(async element => {
    const image = element as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data);
  });
  expect(pixel[2]).toBeGreaterThan(240);
  expect(pixel[0]).toBeLessThan(20);
  const toolbar = page.getByRole("navigation", { name: "Mobile editor actions", exact: true });
  await toolbar.getByRole("button", { name: "Undo last edit", exact: true }).click();
  await expect(image).toHaveAttribute("src", original!);
  await toolbar.getByRole("button", { name: "Redo last edit", exact: true }).click();
  await expect(image).toHaveAttribute("src", cropped!);
  await toolbar.getByRole("button", { name: "Download options", exact: true }).click();
  await expect.poll(async () => (await page.locator(".save-section").boundingBox())!.y).toBeLessThan(200);
  await toolbar.getByRole("button", { name: "View result", exact: true }).click();
  await expect.poll(async () => (await page.locator(".editor-preview-column").boundingBox())!.y).toBeLessThan(200);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("textbox", { name: "Caption", exact: true }).fill("Our saved little moment");
  await page.getByRole("button", { name: "Stickers", exact: true }).click();
  await page.getByLabel("Upload custom sticker", { exact: true }).setInputFiles({
    name: "custom.webp", mimeType: "image/webp", buffer: await readFile("public/stickers/nailong/sticker-hati.webp"),
  });
  await expect(page.locator("[data-sticker-id]")).toHaveCount(1);
  await expect(page.getByText("Draft saved on this device", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Continue draft", exact: true }).click();
  await expect(page.locator("[data-caption-text]")).toHaveText("Our saved little moment");
  await expect(page.locator("[data-photo-slot='0'] img")).toBeVisible();
  await expect(page.locator("[data-sticker-id]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "PNG", exact: true })).toBeEnabled();
  await toolbar.getByRole("button", { name: "View result", exact: true }).click();
  await page.locator(".editor-preview-column").screenshot({ path: info.outputPath("photo-editor-mobile.png"), scale: "css" });
  await page.reload();
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await expect(page.getByRole("button", { name: "Layout", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Layout", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue draft", exact: true })).toHaveCount(0);
});

test("unavailable local storage leaves the photobooth usable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new DOMException("Unavailable", "SecurityError"); } });
  });
  await arrange(page);
  await expect(page.getByText(/Local draft storage is unavailable|This draft could not be saved/)).toBeVisible();
  await expect(page.getByRole("button", { name: "PNG", exact: true })).toBeEnabled();
});
