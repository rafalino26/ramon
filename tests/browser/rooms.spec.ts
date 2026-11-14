import { test, expect, devices, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import type { RoomState } from "../../src/lib/room-client";
import { layouts, getSlotCount } from "../../src/lib/layout";
import { applyDesignChanges, roomDesign } from "../../src/lib/room-design";

test("two participants capture and edit together with automatic sync", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
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
      design: null,
    } as RoomState,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
  const files = new Map<string, Buffer>();
  const receipts = new Set<string>();
  type PhotoEdit = {
    slot: number;
    before: string | null;
    after: string | null;
  };
  const photoJournal: {
    actor: string;
    capture: string;
    changes: PhotoEdit[];
    undone: PhotoEdit[];
    status: string;
  }[] = [];
  const subscribers = new Set<() => void>();
  let interruptNextEdit = false;
  let interruptedActor: string | null = null;
  let portraitBytes = Buffer.alloc(0);
  const device =
    info.project.name === "chromium-phone"
      ? devices["iPhone 13"]
      : info.project.name.startsWith("webkit")
        ? devices["iPad Pro 11"]
        : devices["Desktop Chrome"];
  const contextOptions = {
    ...device,
    userAgent: info.project.use.userAgent ?? device.userAgent,
  };
  const host = await browser.newContext(contextOptions),
    guest = await browser.newContext(contextOptions);
  const install = async (context: BrowserContext, id: string) => {
    await context.routeWebSocket(
      "wss://*.supabase.co/realtime/v1/**",
      (socket) => {
        let topic = "",
          joinRef: string | null = null;
        const notify = () => {
          if (topic)
            socket.send(
              JSON.stringify([
                joinRef,
                null,
                topic,
                "postgres_changes",
                {
                  ids: [1],
                  data: {
                    schema: "public",
                    table: "ramon_rooms",
                    type: "UPDATE",
                    record: room,
                    old_record: {},
                    columns: [],
                    commit_timestamp: new Date().toISOString(),
                    errors: [],
                  },
                },
              ]),
            );
        };
        socket.onMessage((message) => {
          const [join, ref, channel, event, payload] = JSON.parse(
            message.toString(),
          );
          if (event === "phx_join") {
            topic = channel;
            joinRef = join;
            subscribers.add(notify);
            socket.send(
              JSON.stringify([
                join,
                ref,
                channel,
                "phx_reply",
                {
                  status: "ok",
                  response: {
                    postgres_changes: payload.config.postgres_changes.map(
                      (binding: object) => ({ ...binding, id: 1 }),
                    ),
                  },
                },
              ]),
            );
          } else if (event === "heartbeat" || event === "phx_leave") {
            socket.send(
              JSON.stringify([
                join,
                ref,
                channel,
                "phx_reply",
                { status: "ok", response: {} },
              ]),
            );
            if (event === "phx_leave") {
              topic = "";
              subscribers.delete(notify);
            }
          }
        });
        socket.onClose(() => subscribers.delete(notify));
      },
    );
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
        const previousRevision = room.revision;
        if (
          action === "ramon_photo_action" &&
          !receipts.has(args.operation_id)
        ) {
          const count = getSlotCount(
            layouts.find((layout) => layout.id === room.state.layout)!,
          );
          const photos = Array.from(
            { length: count },
            (_, index) => room.state.photos[index] ?? null,
          );
          let edits: PhotoEdit[] = [];
          const own = photoJournal.filter(
            (entry) =>
              entry.actor === id && entry.capture === room.state.captureId,
          );
          const journal =
            args.action === "undo"
              ? own.findLast((entry) => entry.status === "applied")
              : own.find((entry) => entry.status === "undone");
          if (args.action === "undo" || args.action === "redo")
            edits =
              (args.action === "undo" ? journal?.changes : journal?.undone) ??
              [];
          else if (args.action === "clear")
            edits = photos.flatMap((before, slot) =>
              before ? [{ slot, before, after: null }] : [],
            );
          else {
            const slot =
              args.target_slot < 0
                ? photos.findIndex((photo) => !photo)
                : args.target_slot;
            if (slot < 0 || photos[slot] !== (args.expected_photo ?? null))
              return json({ message: "Photo changed", code: "P0001" }, 400);
            const after =
              args.action === "remove"
                ? null
                : args.action === "swap"
                  ? photos[args.other_slot]
                  : args.photo_path;
            edits = [{ slot, before: photos[slot], after }];
            if (args.action === "swap")
              edits.push({
                slot: args.other_slot,
                before: photos[args.other_slot],
                after: photos[slot],
              });
          }
          const applied = edits.filter(
            (edit) =>
              photos[edit.slot] ===
              (args.action === "undo" ? edit.after : edit.before),
          );
          for (const edit of applied)
            photos[edit.slot] =
              args.action === "undo" ? edit.before : edit.after;
          if (journal && args.action === "undo") {
            journal.status = "undone";
            journal.undone = applied;
          } else if (journal && args.action === "redo") {
            journal.status = "applied";
            journal.changes = applied;
          } else if (applied.length) {
            for (const entry of own)
              if (entry.status === "undone") entry.status = "discarded";
            photoJournal.push({
              actor: id,
              capture: room.state.captureId ?? "",
              changes: applied,
              undone: [],
              status: "applied",
            });
          }
          receipts.add(args.operation_id);
          const currentHistory = photoJournal.filter(
            (entry) =>
              entry.actor === id && entry.capture === room.state.captureId,
          );
          room = {
            ...room,
            state: {
              ...room.state,
              photos,
              phase:
                room.state.phase === "edit" || photos.some(Boolean)
                  ? "edit"
                  : "capture",
              photoTools: true,
              photoHistory: {
                ...room.state.photoHistory,
                [id]: {
                  undo: currentHistory.some(
                    (entry) => entry.status === "applied",
                  ),
                  redo: currentHistory.some(
                    (entry) => entry.status === "undone",
                  ),
                },
              },
            },
            revision: room.revision + 1,
          };
        }
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
        if (
          action === "ramon_apply_design" &&
          !receipts.has(args.operation_id)
        ) {
          receipts.add(args.operation_id);
          room = {
            ...room,
            state: {
              ...room.state,
              design: applyDesignChanges(
                roomDesign(room.state.design),
                args.changes,
              ),
            },
            revision: room.revision + 1,
          };
        }
        if (action === "ramon_retake_photo") {
          if (room.revision !== args.expected_revision)
            return json({ message: "Room changed", code: "P0001" }, 400);
          room = {
            ...room,
            state: {
              ...room.state,
              phase: "capture",
              photos: room.state.photos.slice(
                0,
                room.state.photoMode === "single" ? -1 : -2,
              ),
              captureId: randomUUID(),
            },
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
        if (action === "ramon_start_single_capture") {
          room = {
            ...room,
            state: {
              ...room.state,
              phase: "capture",
              photoMode: "single",
              photoTools: true,
              photoHistory: {},
              photos: [],
              captureId: randomUUID(),
            },
            revision: room.revision + 1,
          };
        }
        if (action === "ramon_submit_single_photo") {
          const slots = getSlotCount(
            layouts.find((layout) => layout.id === room.state.layout)!,
          );
          if (room.state.photos.length >= slots)
            return json({ message: "The layout is full", code: "P0001" }, 400);
          const photos = [...room.state.photos, args.photo_path];
          room = {
            ...room,
            state: {
              ...room.state,
              photos,
              phase: photos.length === slots ? "edit" : "capture",
            },
            editor: hostId,
            revision: room.revision + 1,
          };
        }
        if (action === "ramon_layout_action") {
          if (room.revision !== args.expected_revision)
            return json({ message: "Room changed", code: "P0001" }, 400);
          if (args.action === "continue")
            room.state = {
              ...room.state,
              phase: "layout",
              layoutChosen: false,
            };
          if (args.action === "change")
            room.state = {
              ...room.state,
              phase: "layout",
              photos: [],
              layoutChosen: true,
              captureId: randomUUID(),
            };
          if (args.action === "select")
            room.state = {
              ...room.state,
              layout: args.layout_id,
              layoutChosen: true,
            };
          if (args.action === "start")
            room.state = {
              ...room.state,
              phase: "capture",
              photos: [],
              captureId: randomUUID(),
            };
          room.revision++;
        }
        if (previousRevision !== room.revision)
          for (const notify of subscribers) notify();
        if (
          action === "ramon_apply_design" &&
          (interruptNextEdit || interruptedActor === id)
        ) {
          interruptNextEdit = false;
          interruptedActor = id;
          return route.abort("failed");
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
    await Promise.all(
      [host, guest].map((context) =>
        context.addInitScript(() =>
          Object.defineProperty(navigator, "canShare", {
            value: () => false,
            configurable: true,
          }),
        ),
      ),
    );
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
    await expect(
      a.getByRole("button", { name: "Continue", exact: true }),
    ).toBeDisabled();
    code = (await a.locator(".room-summary strong").textContent())!;
    await b.goto(`/together?room=${code}`);
    await expect(
      b.getByRole("button", { name: "Create room", exact: true }),
    ).toHaveCount(0);
    await expect(b.getByLabel("Room code", { exact: true })).toHaveValue(code);
    await expect(b.getByLabel("Room code", { exact: true })).toHaveJSProperty(
      "readOnly",
      true,
    );
    await b.screenshot({
      path: info.outputPath("invitation.png"),
      fullPage: true,
    });
    await b.getByLabel("Your name", { exact: true }).fill("Partner");
    await b.getByRole("button", { name: "Join room", exact: true }).click();
    await expect(a.getByText("2/2 people", { exact: false })).toBeVisible();
    await expect(
      a.getByRole("button", { name: "1 x 1 layout", exact: true }),
    ).toHaveCount(0);
    await b.getByRole("button", { name: "Continue", exact: true }).click();
    await b.getByRole("button", { name: "1 x 1 layout", exact: true }).click();
    await expect(
      a.getByRole("button", { name: "1 x 1 layout", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await a
      .getByRole("button", { name: "Start taking photos", exact: true })
      .click();
    await b.getByRole("button", { name: "Change layout", exact: true }).click();
    await a.getByRole("button", { name: "2 x 2 layout", exact: true }).click();
    await expect(
      b.getByRole("button", { name: "2 x 2 layout", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await a.getByRole("button", { name: "2 x 3 layout", exact: true }).click();
    await expect(
      b.getByRole("button", { name: "2 x 3 layout", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await b
      .getByRole("button", { name: "Start taking photos", exact: true })
      .click();
    let cameraStream = "";
    if (
      info.project.name.startsWith("chromium") &&
      !process.env.RAMON_LIVE_ROOM_TEST
    ) {
      await a
        .getByRole("button", { name: "Open my camera", exact: true })
        .click();
      await expect(
        a.getByRole("button", { name: "Take & share photo", exact: true }),
      ).toBeEnabled();
      await a.getByRole("button", { name: "16:9 frame", exact: true }).click();
      await expect(
        a.getByLabel("Camera preview", { exact: true }),
      ).toHaveAttribute("data-view", "wide");
      await a.getByRole("button", { name: "Auto view", exact: true }).click();
      await a.getByRole("button", { name: "B&W", exact: true }).click();
      await expect(a.locator("video")).toHaveCSS("filter", /grayscale/);
      await a.getByRole("button", { name: "Normal", exact: true }).click();
      await a.getByRole("button", { name: "3s", exact: true }).click();
      await a
        .getByRole("button", { name: "Take & share photo", exact: true })
        .click();
      await expect(
        a.getByRole("button", { name: "Cancel timer", exact: true }),
      ).toBeVisible();
      expect(
        await a.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(a.viewportSize()!.width + 1);
      await a
        .getByRole("button", { name: "Cancel timer", exact: true })
        .click();
      await expect(a.getByTestId("room-photo-count")).toHaveText(
        "0 of 6 photos shared",
      );
      await a.getByRole("button", { name: "Timer off", exact: true }).click();
      await a
        .getByRole("button", { name: "Switch camera", exact: true })
        .click();
      await expect(
        a.getByRole("button", { name: "Take & share photo", exact: true }),
      ).toBeEnabled();
      await a
        .getByRole("button", { name: "Switch camera", exact: true })
        .click();
      await expect(
        a.getByRole("button", { name: "Take & share photo", exact: true }),
      ).toBeEnabled();
      cameraStream = await a
        .locator("video")
        .evaluate(
          (video) => ((video as HTMLVideoElement).srcObject as MediaStream).id,
        );
    }
    for (const [index, page] of [b, a, a, b, b, a].entries()) {
      await expect(
        page.getByText("Both cameras are ready", { exact: false }),
      ).toBeVisible();
      if (
        page === a &&
        info.project.name.startsWith("chromium") &&
        !process.env.RAMON_LIVE_ROOM_TEST
      ) {
        await expect(
          page.getByRole("button", { name: "Take & share photo", exact: true }),
        ).toBeEnabled();
        await page
          .getByRole("button", { name: "Take & share photo", exact: true })
          .click();
      } else {
        await page
          .getByLabel("Upload a room photo", { exact: true })
          .setInputFiles({
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
      if (index < 5) {
        await expect(page.getByTestId("room-photo-count")).toHaveText(
          `${index + 1} of 6 photos shared`,
          { timeout: 15000 },
        );
        await expect(page.locator("[data-photo-slot] img:visible")).toHaveCount(
          index + 1,
          { timeout: 15000 },
        );
      }
      if (index === 0) {
        await expect(
          b.getByRole("button", { name: "Open my camera", exact: true }),
        ).toBeEnabled();
        await expect(
          a.locator(
            '[data-testid="photostrip"]:visible [data-photo-slot="0"] img',
          ),
        ).toBeVisible({ timeout: 15000 });
        await a
          .getByRole("button", { name: "Change layout", exact: true })
          .click();
        await expect(a.getByRole("alertdialog")).toBeVisible();
        await a
          .getByRole("button", { name: "Keep current layout", exact: true })
          .click();
        await expect(
          a.locator(
            '[data-testid="photostrip"]:visible [data-photo-slot="0"] img',
          ),
        ).toBeVisible({ timeout: 15000 });
        if (cameraStream)
          await expect
            .poll(() =>
              a
                .locator("video")
                .evaluate(
                  (video) =>
                    ((video as HTMLVideoElement).srcObject as MediaStream).id,
                ),
            )
            .toBe(cameraStream);
        await b
          .getByRole("tab", { name: "Decorate together", exact: true })
          .click();
        await b.getByRole("button", { name: "Polaroid", exact: true }).click();
        await expect(
          a.locator('[data-testid="photostrip"]:visible'),
        ).toHaveClass(/frame-polaroid/);
        await b.getByRole("tab", { name: /Camera & photos/ }).click();
        await a.screenshot({
          path: info.outputPath("camera-workspace.png"),
          fullPage: true,
        });
        const layout = await a.evaluate(() => ({
          inner: innerWidth,
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          wide: [...document.querySelectorAll("body *")]
            .map((element) => ({
              tag: element.tagName,
              class: element.getAttribute("class"),
              right: Math.round(element.getBoundingClientRect().right),
              width: Math.round(element.getBoundingClientRect().width),
            }))
            .filter(
              (item) =>
                item.right > document.documentElement.clientWidth + 2 &&
                item.width > 0,
            )
            .slice(0, 20),
        }));
        expect(layout.scroll, JSON.stringify(layout)).toBeLessThanOrEqual(
          a.viewportSize()!.width + 1,
        );
      }
    }
    await expect(a.getByTestId("design-sync-status")).toContainText("Live", {
      timeout: 20000,
    });
    await expect(b.getByTestId("design-sync-status")).toContainText("Live", {
      timeout: 20000,
    });
    await expect(
      a.getByRole("button", { name: "Save & pass control", exact: true }),
    ).toHaveCount(0);
    await expect(a.locator("[data-photo-slot] img:visible")).toHaveCount(6);
    const firstPhoto = a.locator('[data-room-photo-slot="0"] img');
    const secondPhoto = a.locator('[data-room-photo-slot="1"] img');
    const originalFirst = await firstPhoto.getAttribute("src");
    const originalSecond = await secondPhoto.getAttribute("src");
    await b
      .getByRole("button", { name: "Delete photo 2", exact: true })
      .click();
    await expect(b.getByTestId("room-photo-count")).toHaveText(
      "5 of 6 photos shared",
    );
    await expect(secondPhoto).toHaveCount(0);
    await expect(firstPhoto).toHaveAttribute("src", originalFirst!);
    await expect(
      a.getByRole("button", { name: "PNG", exact: true }),
    ).toBeEnabled();
    await b.getByRole("button", { name: "Undo photo", exact: true }).click();
    await expect(secondPhoto).toHaveAttribute("src", originalSecond!);
    await b.getByRole("button", { name: "Redo photo", exact: true }).click();
    await expect(secondPhoto).toHaveCount(0);
    await b.getByRole("button", { name: "Undo photo", exact: true }).click();
    await expect(secondPhoto).toHaveAttribute("src", originalSecond!);
    await b
      .getByRole("button", { name: "Retake photo 1", exact: true })
      .click();
    await expect(b.getByTestId("room-photo-count")).toHaveText(
      "6 of 6 photos shared",
    );
    await b.getByLabel("Upload a room photo", { exact: true }).setInputFiles({
      name: "replacement.jpg",
      mimeType: "image/jpeg",
      buffer: portraitBytes,
    });
    await b
      .getByRole("button", { name: "Use this photo", exact: true })
      .click();
    await expect(firstPhoto).not.toHaveAttribute("src", originalFirst!);
    await expect(secondPhoto).toHaveAttribute("src", originalSecond!);
    const replacement = await firstPhoto.getAttribute("src");
    await a
      .getByRole("button", { name: "Retake photo 2", exact: true })
      .click();
    await a.getByRole("button", { name: "Move earlier", exact: true }).click();
    await expect(firstPhoto).toHaveAttribute("src", originalSecond!);
    await expect(secondPhoto).toHaveAttribute("src", replacement!);
    await a.getByRole("button", { name: "Undo photo", exact: true }).click();
    await expect(firstPhoto).toHaveAttribute("src", replacement!);
    await expect(secondPhoto).toHaveAttribute("src", originalSecond!);
    await b.getByRole("button", { name: "Clear photos", exact: true }).click();
    await b
      .getByRole("button", { name: "Clear all photos", exact: true })
      .click();
    await expect(b.getByTestId("room-photo-count")).toHaveText(
      "0 of 6 photos shared",
    );
    await b.getByRole("button", { name: "Undo photo", exact: true }).click();
    await expect(b.getByTestId("room-photo-count")).toHaveText(
      "6 of 6 photos shared",
    );
    await a
      .getByRole("tab", { name: "Decorate together", exact: true })
      .click();
    await a.getByRole("button", { name: "Text", exact: true }).click();
    await a.getByRole("button", { name: "Better together", exact: true }).click();
    await expect(b.locator("[data-caption-text]")).toHaveText("Better together");
    await a.getByRole("button", { name: "Undo design change", exact: true }).click();
    await expect(b.locator("[data-caption-text]")).toHaveCount(0);
    await Promise.all([
      a.getByLabel("Caption", { exact: true }).fill("Together, from afar"),
      b.getByRole("button", { name: "Thin", exact: true }).click(),
    ]);
    await expect(a.locator('[data-testid="photostrip"]:visible')).toHaveClass(
      /frame-thin/,
    );
    await expect(a.getByLabel("Caption", { exact: true })).toHaveValue(
      "Together, from afar",
    );
    await a.getByLabel("Caption", { exact: true }).press("Tab");
    await expect(b.locator("[data-caption-text]")).toHaveText(
      "Together, from afar",
    );
    await a
      .getByRole("button", { name: "Undo design change", exact: true })
      .click();
    await expect(b.locator("[data-caption-text]")).toHaveCount(0);
    await expect(b.locator('[data-testid="photostrip"]:visible')).toHaveClass(
      /frame-thin/,
    );
    await a
      .getByRole("button", { name: "Redo design change", exact: true })
      .click();
    await expect(b.locator("[data-caption-text]")).toHaveText(
      "Together, from afar",
    );
    await Promise.all([
      a.getByRole("button", { name: "Stickers", exact: true }).click(),
      b.getByRole("button", { name: "Stickers", exact: true }).click(),
    ]);
    await Promise.all([
      a.locator(".sticker-catalog button").first().click(),
      b.locator(".sticker-catalog button").nth(1).click(),
    ]);
    await expect(a.locator("[data-sticker-id]")).toHaveCount(2);
    await expect(b.locator("[data-sticker-id]")).toHaveCount(2);
    await a.getByLabel("Upload custom sticker", { exact: true }).setInputFiles({
      name: "custom.jpg",
      mimeType: "image/jpeg",
      buffer: portraitBytes,
    });
    await expect(b.locator("[data-sticker-id]")).toHaveCount(3, {
      timeout: 15000,
    });
    await b.locator(".placed-stickers button").last().click();
    await b
      .getByRole("button", { name: "Delete selected sticker", exact: true })
      .click();
    await expect(a.locator("[data-sticker-id]")).toHaveCount(2);
    await expect(a.getByTestId("design-sync-status")).toContainText(
      "All changes saved",
      { timeout: 15000 },
    );
    await expect(b.getByTestId("design-sync-status")).toContainText(
      "All changes saved",
      { timeout: 15000 },
    );
    if (!process.env.RAMON_LIVE_ROOM_TEST) {
      await a.getByRole("button", { name: "Frame", exact: true }).click();
      interruptNextEdit = true;
      await a.getByRole("button", { name: "Rounded", exact: true }).click();
      await expect(a.getByTestId("design-sync-status")).toContainText(
        "Changes waiting to sync",
      );
      await b.getByRole("button", { name: "Frame", exact: true }).click();
      await expect(
        b.getByRole("button", { name: "Rounded", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await b.getByRole("button", { name: "Thin", exact: true }).click();
      await expect(b.getByTestId("design-sync-status")).toContainText(
        "All changes saved",
      );
      interruptedActor = null;
      await a.getByRole("button", { name: "Retry sync", exact: true }).click();
      await expect(a.getByTestId("design-sync-status")).toContainText(
        "All changes saved",
        { timeout: 15000 },
      );
      await expect(a.locator('[data-testid="photostrip"]:visible')).toHaveClass(
        /frame-thin/,
      );
    }
    await expect(
      a.getByRole("button", { name: "PNG", exact: true }),
    ).toBeEnabled();
    await expect(
      b.getByRole("button", { name: "PNG", exact: true }),
    ).toBeEnabled();
    await a.screenshot({
      path: info.outputPath("editing-together.png"),
      fullPage: true,
    });
    await expect(
      a.getByRole("button", { name: "PDF", exact: true }),
    ).toBeEnabled({ timeout: 15000 });
    const pdfPending = a.waitForEvent("download");
    await a.getByRole("button", { name: "PDF", exact: true }).click();
    const pdfDownload = await pdfPending;
    expect(pdfDownload.suggestedFilename()).toBe("ramon-photobooth.pdf");
    const pdf = await PDFDocument.load(
      await readFile((await pdfDownload.path())!),
    );
    expect(pdf.getPageCount()).toBe(1);
    await b
      .getByRole("button", { name: "Retake the last photo", exact: true })
      .click();
    await expect(b.getByTestId("room-photo-count")).toHaveText(
      "6 of 6 photos shared",
    );
    await expect(b.locator("[data-photo-slot] img:visible")).toHaveCount(6);
    await b.getByLabel("Upload a room photo", { exact: true }).setInputFiles({
      name: "retake.jpg",
      mimeType: "image/jpeg",
      buffer: portraitBytes,
    });
    await b
      .getByRole("button", { name: "Use this photo", exact: true })
      .click();
    await expect(a.getByTestId("design-sync-status")).toBeVisible({
      timeout: 15000,
    });
    await expect(a.locator("[data-photo-slot] img:visible")).toHaveCount(6);
    await expect(a.locator("[data-caption-text]")).toHaveText(
      "Together, from afar",
    );
    await b.getByRole("button", { name: "Change layout", exact: true }).click();
    await b
      .getByRole("button", {
        name: "Change layout and clear photos",
        exact: true,
      })
      .click();
    await b.getByRole("button", { name: "2 x 2 layout", exact: true }).click();
    await expect(
      a.getByRole("button", { name: "2 x 2 layout", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await a.screenshot({
      path: info.outputPath("together-host.png"),
      fullPage: true,
    });
  } finally {
    await host.close();
    await guest.close();
  }
});
