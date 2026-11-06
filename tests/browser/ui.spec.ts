import { expect, test } from "@playwright/test";

test("camera permission errors offer a usable retry on a small phone", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium-phone");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = (constraints) => {
      if (document.documentElement.dataset.simulatedCameraAllowed !== "true") {
        return Promise.reject(
          new DOMException("Permission denied", "NotAllowedError"),
        );
      }
      return original(constraints);
    };
  });
  await page.goto("/photobooth");
  await page.getByRole("button", { name: "1 x 1 layout", exact: true }).click();
  await page.getByRole("button", { name: "Use camera", exact: true }).click();
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await expect(retry).toBeVisible();
  const box = await retry.boundingBox();
  const preview = await page.locator(".camera-viewport").boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    preview!.y + preview!.height,
  );
  await page.locator("html").evaluate((element) => {
    element.dataset.simulatedCameraAllowed = "true";
  });
  await retry.click();
  await expect(
    page.getByRole("button", { name: "Capture (0/1)", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".camera-error[role='alert']")).toHaveCount(0);
});

test("short phone screens keep the shutter within reach", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium-phone");
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/photobooth");
    await page
      .getByRole("button", { name: "1 x 1 layout", exact: true })
      .click();
    await page.getByRole("button", { name: "Use camera", exact: true }).click();
    const shutter = page.getByRole("button", {
      name: "Capture (0/1)",
      exact: true,
    });
    await expect(shutter).toBeEnabled({ timeout: 20_000 });
    const box = await shutter.boundingBox();
    expect(box!.y).toBeGreaterThan(0);
    expect(box!.y + box!.height).toBeLessThan(viewport.height + 5);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});

test("all pages fit the screen and navigation works", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [path, name] of [
    ["/", "home"],
    ["/about-us", "story"],
    ["/contact", "contact"],
    ["/photobooth", "studio"],
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`${name}.png`),
      fullPage: true,
      animations: "disabled",
      scale: "css",
    });
  }
  if (page.viewportSize()!.width < 768) {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Mobile navigation", exact: true })
      .getByRole("link", { name: "Contact", exact: true })
      .click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(
      page.getByRole("navigation", { name: "Mobile navigation", exact: true }),
    ).toHaveCount(0);
  } else {
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("link", { name: "Contact", exact: true })
      .click();
  }
  await page.getByText("Where do my photos go?", { exact: true }).click();
  await expect(
    page.getByText(
      "Your photos stay in your browser while you use the booth.",
      { exact: false },
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("camera adapts to the screen and captures the visible crop", async ({
  page,
}, info) => {
  test.skip(!info.project.name.startsWith("chromium"));
  await page.goto("/photobooth");
  await page.getByRole("button", { name: "2 x 1 layout", exact: true }).click();
  await page.getByRole("button", { name: "Use camera", exact: true }).click();
  const capture = page.getByRole("button", {
    name: "Capture (0/2)",
    exact: true,
  });
  await expect(capture).toBeEnabled({ timeout: 20_000 });
  const portrait = info.project.name === "chromium-phone";
  const box = await page.locator(".camera-viewport").boundingBox();
  expect(box!.width / box!.height).toBeCloseTo(portrait ? 3 / 4 : 4 / 3, 2);
  if (portrait) {
    const button = await capture.boundingBox();
    expect(button!.y + button!.height).toBeLessThan(
      page.viewportSize()!.height + 5,
    );
  }
  await page.screenshot({
    path: info.outputPath("camera.png"),
    fullPage: true,
    animations: "disabled",
    scale: "css",
  });
  await capture.click();
  const image = page.getByAltText("Capture 1", { exact: true });
  await expect(image).toBeVisible();
  const sourceRatio = await image.evaluate((element) => {
    const image = element as HTMLImageElement;
    return image.naturalWidth / image.naturalHeight;
  });
  expect(sourceRatio).toBeCloseTo(box!.width / box!.height, 2);
  if (portrait) {
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(
      page.getByRole("button", { name: "Capture (1/2)", exact: true }),
    ).toBeEnabled({ timeout: 20_000 });
    const rotated = await page.locator(".camera-viewport").boundingBox();
    expect(rotated!.width / rotated!.height).toBeCloseTo(4 / 3, 2);
    const rotatedButton = await page
      .getByRole("button", { name: "Capture (1/2)", exact: true })
      .boundingBox();
    expect(rotatedButton!.y).toBeGreaterThanOrEqual(0);
    expect(rotatedButton!.y + rotatedButton!.height).toBeLessThan(395);
    await expect(
      page.getByRole("combobox", { name: "Camera filter", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Camera filter", exact: true })
      .selectOption("vintage");
    await page.screenshot({
      path: info.outputPath("camera-landscape.png"),
      fullPage: true,
      animations: "disabled",
      scale: "css",
    });
  }
  await page
    .getByRole("button", { name: "Capture (1/2)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Make it yours", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "PNG", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: info.outputPath("editor.png"),
    fullPage: true,
    animations: "disabled",
    scale: "css",
  });
});
