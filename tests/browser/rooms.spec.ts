import { test, expect, devices, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("guests shoot in either order with a shared preview and pass editing control", async ({
  browser,
}, info) => {
  test.setTimeout(90_000);
  const hostId: string = randomUUID(),
    guestId: string = randomUUID();
  let code = "ABCDEF123456";
  let room = {
    code,
    members: [hostId],
    names: ["Rafa"],
    editor: hostId,
    revision: 0,
    state: {
      phase: "lobby",
      layout: "2x2",
      photos: [] as string[],
      design: null as unknown,
    },
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
  const files = new Map<string, Buffer>();
  let portraitBytes = Buffer.alloc(0);
  const device =
    info.project.name === "chromium-phone"
      ? devices["iPhone 13"]
      : info.project.name.startsWith("webkit")
        ? devices["iPad Pro 11"]
        : devices["Desktop Chrome"];
  const host = await browser.newContext(device),
    guest = await browser.newContext(device);
  const install = async (context: BrowserContext, id: string) => {
    await context.route("https://*.supabase.co/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const json = (data: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (url.pathname === "/auth/v1/signup") {
        const payload = {
          sub: id,
          aud: "authenticated",
          role: "authenticated",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
        const token = [
          Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
          Buffer.from(JSON.stringify(payload)).toString("base64url"),
          "signature",
        ].join(".");
        return json({
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: randomUUID(),
          user: {
            id,
            aud: "authenticated",
            role: "authenticated",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
            is_anonymous: true,
          },
        });
      }
      if (url.pathname.includes("/rest/v1/rpc/")) {
        const action = url.pathname.split("/").pop();
        const args = request.postDataJSON();
        if (action === "ramon_join_room" && !room.members.includes(id))
          room = {
            ...room,
            members: [...room.members, id],
            names: [...room.names, args.display_name],
            revision: room.revision + 1,
          };
        if (action === "ramon_save_room") {
          if (room.editor !== id || room.revision !== args.expected_revision)
            return json({ message: "Room changed", code: "P0001" }, 400);
          room = {
            ...room,
            editor: args.next_editor,
            state: args.next_state,
            revision: room.revision + 1,
          };
        }
        if (action === "ramon_submit_photo") {
          const photos = [...room.state.photos, args.photo_path];
          room = {
            ...room,
            state: { ...room.state, photos, phase: "edit" },
            editor: hostId,
            revision: room.revision + 1,
          };
          if (photos.length < 2) room.state.phase = "capture";
        }
        return json(room);
      }
      const marker = "/storage/v1/object/";
      if (url.pathname.includes(marker)) {
        const key = url.pathname
          .slice(url.pathname.indexOf(marker) + marker.length)
          .replace(/^authenticated\//, "");
        if (request.method() === "POST") {
          // Use a valid fixture for intercepted binary uploads. Live mode tests
          // the actual multipart bodies against Supabase on both browser engines.
          files.set(key, portraitBytes);
          return json({ Key: key });
        }
        if (request.method() === "GET" && files.has(key))
          return route.fulfill({
            contentType: "image/jpeg",
            body: files.get(key)!,
          });
        return json({ message: "Not found" }, 404);
      }
      return json({});
    });
  };
  try {
    if (!process.env.RAMON_LIVE_ROOM_TEST) {
      await install(host, hostId);
      await install(guest, guestId);
    }
    const a = await host.newPage(),
      b = await guest.newPage();
    portraitBytes = Buffer.from(
      await a.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = 800;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "#e598bd";
        context.fillRect(0, 0, 600, 800);
        return canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
      }),
      "base64",
    );
    await a.goto("/together");
    await a.getByLabel("Your name", { exact: true }).fill("Rafa");
    await a.getByRole("button", { name: "Create room", exact: true }).click();
    await expect(a.getByText("1/2 people", { exact: false })).toBeVisible();
    code = (await a.locator(".room-summary strong").textContent())!;
    await b.goto(`/together?room=${code}`);
    await b.getByLabel("Your name", { exact: true }).fill("Partner");
    await b.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(a.getByText("2/2 people", { exact: false })).toBeVisible();
    await a.getByLabel("Room layout").selectOption("1x1");
    await a
      .getByRole("button", { name: "Start taking photos", exact: true })
      .click();
    let cameraStream = "";
    if (info.project.name === "chromium" && !process.env.RAMON_LIVE_ROOM_TEST) {
      await a
        .getByRole("button", { name: "Open my camera", exact: true })
        .click();
      await expect(
        a.getByRole("button", { name: "Take & share photo", exact: true }),
      ).toBeEnabled();
      cameraStream = await a
        .locator("video")
        .evaluate((video) => (video.srcObject as MediaStream).id);
    }
    for (const page of [b, a]) {
      await expect(
        page.getByText("Both cameras are ready", { exact: false }),
      ).toBeVisible();
      if (
        page === a &&
        info.project.name === "chromium" &&
        !process.env.RAMON_LIVE_ROOM_TEST
      ) {
        await expect(
          page.getByRole("button", { name: "Take & share photo", exact: true }),
        ).toBeEnabled();
        await page
          .getByRole("button", { name: "Take & share photo", exact: true })
          .click();
      } else {
        await page.locator('input[type="file"]').setInputFiles({
          name: "portrait.svg",
          mimeType: "image/svg+xml",
          buffer: Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#e598bd"/></svg>',
          ),
        });
        await page
          .getByRole("button", { name: "Use this photo", exact: true })
          .click();
        await expect(
          page.getByRole("button", { name: "Use this photo", exact: true }),
        ).not.toBeVisible({ timeout: 20000 });
      }
      if (page === b) {
        await expect(
          b.getByText("Your portrait is in this slot.", { exact: false }),
        ).toBeVisible({ timeout: 15000 });
        await expect(
          a.locator('[data-testid="photostrip"] [data-photo-slot="0"] img'),
        ).toBeVisible({ timeout: 15000 });
        if (cameraStream)
          await expect
            .poll(() =>
              a
                .locator("video")
                .evaluate((video) => (video.srcObject as MediaStream).id),
            )
            .toBe(cameraStream);
      }
    }
    await expect(
      a.getByRole("button", { name: "Share design changes", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await a.getByRole("button", { name: "Text", exact: true }).click();
    await a.getByLabel("Caption", { exact: true }).fill("Together, from afar");
    await a.getByLabel("Caption", { exact: true }).press("Tab");
    await a
      .getByRole("button", { name: "Save & pass control", exact: true })
      .click();
    await expect(
      b.getByRole("button", { name: "Share design changes", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(b.locator("[data-caption-text]")).toHaveText(
      "Together, from afar",
    );
    await expect(
      a.getByRole("button", { name: "PNG", exact: true }),
    ).toBeEnabled();
    await expect(
      b.getByRole("button", { name: "PNG", exact: true }),
    ).toBeEnabled();
    await a.screenshot({
      path: info.outputPath("together-host.png"),
      fullPage: true,
    });
  } finally {
    await host.close();
    await guest.close();
  }
});
