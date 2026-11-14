import { expect, test } from "@playwright/test";

for (const multipleFrontLenses of [false, true]) {
  test(`portrait camera preserves the full source with ${multipleFrontLenses ? "multiple front lenses" : "one front lens"}`, async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-phone");
    await page.addInitScript(({ multipleFrontLenses }) => {
      const requests: MediaTrackConstraints[] = [];
      Object.assign(window, { cameraRequests: requests });
      const devices = [
        { deviceId: "front", label: "Front Camera", kind: "videoinput", groupId: "front" },
        ...(multipleFrontLenses ? [{ deviceId: "front-wide", label: "Front Ultra Wide Camera", kind: "videoinput", groupId: "front" }] : []),
      ];
      navigator.mediaDevices.enumerateDevices = async () => devices as MediaDeviceInfo[];
      navigator.mediaDevices.getUserMedia = async constraints => {
        const video = constraints!.video as MediaTrackConstraints;
        requests.push(video);
        const id = (video.deviceId as ConstrainDOMStringParameters)?.exact ?? "front";
        const canvas = document.createElement("canvas");
        canvas.width = 960;
        canvas.height = 540;
        const context = canvas.getContext("2d")!;
        const draw = () => {
          context.fillStyle = "#00ff00";
          context.fillRect(0, 0, 960, 540);
          context.fillStyle = "#ff0000";
          context.fillRect(0, 0, 150, 540);
          context.fillStyle = "#0000ff";
          context.fillRect(810, 0, 150, 540);
        };
        draw();
        const stream = canvas.captureStream(10);
        const track = stream.getVideoTracks()[0];
        const interval = setInterval(draw, 100);
        const stop = track.stop.bind(track);
        track.stop = () => { clearInterval(interval); stop(); };
        Object.defineProperty(track, "label", { value: devices.find(device => device.deviceId === id)?.label });
        track.getSettings = () => ({ deviceId: String(id), width: 960, height: 540 });
        return stream;
      };
    }, { multipleFrontLenses });
    await page.goto("/photobooth");
    await page.getByRole("button", { name: "2 x 1 layout", exact: true }).click();
    await page.getByRole("button", { name: "Use camera", exact: true }).click();
    const capture = page.getByRole("button", { name: "Capture (0/2)", exact: true });
    await expect(capture).toBeEnabled();
    await expect(page.locator("video")).toHaveCSS("object-fit", "contain");
    await expect.poll(() => page.evaluate(() => (window as unknown as { cameraRequests: unknown[] }).cameraRequests.length)).toBe(1);
    if (multipleFrontLenses) {
      const selection = page.getByRole("combobox", { name: "Camera device", exact: true });
      await selection.selectOption("front-wide");
      await expect(capture).toBeEnabled();
      await expect(page.locator(".camera-status")).toContainText("Front camera");
      await page.getByRole("button", { name: "Switch lens", exact: true }).click();
      await expect(selection).toHaveValue("front");
      await expect(capture).toBeEnabled();
    } else {
      await expect(page.getByRole("button", { name: "Switch lens", exact: true })).toHaveCount(0);
    }
    const requestCount = await page.evaluate(() => (window as unknown as { cameraRequests: unknown[] }).cameraRequests.length);
    await page.getByRole("button", { name: "16:9 frame", exact: true }).click();
    await expect(page.locator("video")).toHaveCSS("object-fit", "cover");
    await page.getByRole("button", { name: "Auto view", exact: true }).click();
    await expect(capture).toBeEnabled();
    expect(await page.evaluate(() => (window as unknown as { cameraRequests: unknown[] }).cameraRequests.length)).toBe(requestCount);
    const requests = await page.evaluate(() => (window as unknown as { cameraRequests: MediaTrackConstraints[] }).cameraRequests);
    for (const request of requests) {
      expect(request.aspectRatio).toBeUndefined();
      expect(request.width).toEqual({ ideal: 1920 });
      expect(request.height).toEqual({ ideal: 1440 });
    }
    // Disable mirroring so the source's red and blue edges are easy to compare.
    await page.getByRole("button", { name: "Mirror camera", exact: true }).click();
    await capture.click();
    const image = page.getByAltText("Capture 1", { exact: true });
    await expect(image).toBeVisible();
    const result = await image.evaluate(async element => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      return {
        width: canvas.width, height: canvas.height,
        left: Array.from(context.getImageData(10, 10, 1, 1).data),
        right: Array.from(context.getImageData(canvas.width - 10, 10, 1, 1).data),
      };
    });
    expect(result.width).toBe(960);
    expect(result.height).toBe(540);
    expect(result.left[0]).toBeGreaterThan(240);
    expect(result.right[2]).toBeGreaterThan(240);
  });
}
