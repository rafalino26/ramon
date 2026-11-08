"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRoomClient,
  roomIdentity,
  roomRpc,
  type Room,
  type RoomClient,
} from "@/lib/room-client";
import { layouts, getSlotCount, getCells } from "@/lib/layout";
import { createDesign, type EditorDesign } from "@/lib/editor-design";
import { mapChangeSources, type DesignChange } from "@/lib/room-design";
import { composeRoomPhoto } from "@/lib/room-collage";
import RoomCamera from "./RoomCamera";
import RoomEditor from "./RoomEditor";
import PhotostripPreview from "../components/photostrip";
import LayoutGallery from "../components/LayoutGallery";

export default function Together() {
  const client = useRef<RoomClient | null>(null);
  const [user, setUser] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const current = useRef<Room | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [entryReady, setEntryReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmLayout, setConfirmLayout] = useState(false);
  const locked = useRef(false);
  const assets = useRef(new Map<string, string>());
  const sourcePaths = useRef(new Map<string, string>());
  const uploads = useRef(new Map<string, Promise<string>>());
  const [live, setLive] = useState(false);
  const [preparation, setPrepared] = useState<{
    key: string;
    photos: (string | null)[];
    design: EditorDesign;
  } | null>(null);
  const accept = useCallback((next: Room) => {
    if (
      !current.current ||
      current.current.code !== next.code ||
      next.revision > current.current.revision
    ) {
      current.current = next;
      setRoom(next);
    }
  }, []);
  useEffect(() => {
    const cache = assets.current;
    const params = new URLSearchParams(location.search);
    const invitation = params.has("room")
      ? (params.get("room") ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase()
      : null;
    setInviteCode(invitation);
    setCode(invitation ?? sessionStorage.getItem("ramon-room") ?? "");
    setEntryReady(true);
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);
  const connect = async () => {
    client.current ??= createRoomClient();
    const id = await roomIdentity(client.current);
    setUser(id);
    return client.current;
  };
  const run = async (task: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The room could not be updated.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const roomCode = room?.code;
  useEffect(() => {
    if (!roomCode) return;
    let active = true;
    let connected = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!locked.current) {
        try {
          const next = await roomRpc(client.current!, "ramon_get_room", {
            room_code: roomCode,
          });
          if (active && current.current?.code === next.code) {
            accept(next);
            setNotice("");
          }
        } catch {
          if (active)
            setNotice(
              "Reconnecting… If this room has expired, leave and create a new one.",
            );
        }
      }
      if (active)
        timer = setTimeout(poll, document.hidden || connected ? 15000 : 2000);
    };
    const api = client.current!;
    const refresh = () => {
      if (document.hidden) return;
      void roomRpc(api, "ramon_get_room", { room_code: roomCode })
        .then((next) => {
          if (active && current.current?.code === next.code) accept(next);
        })
        .catch(() => {});
    };
    const channel = api
      .channel(`ramon:${roomCode}`, {
        config: { postgres_changes_options: { wait: true } },
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ramon_rooms",
          filter: `code=eq.${roomCode}`,
        },
        (payload) => {
          const next = payload.new as Room;
          if (
            active &&
            current.current?.code === next.code &&
            Array.isArray(next.members) &&
            next.state
          )
            accept(next);
        },
      )
      .subscribe((status) => {
        if (!active) return;
        connected = status === "SUBSCRIBED";
        setLive(connected);
        // Re-read after every successful (re)subscription to close event gaps.
        if (connected) refresh();
      });
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    timer = setTimeout(poll, 2000);
    return () => {
      active = false;
      clearTimeout(timer);
      void api.removeChannel(channel);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [roomCode, accept]); // Revisions do not restart the polling loop.
  const resolveAsset = useCallback(async (path: string) => {
    const existing = assets.current.get(path);
    if (existing) return existing;
    if (!current.current || !path.startsWith(current.current.code + "/"))
      throw new Error("Invalid room photo path.");
    const { data, error } = await client
      .current!.storage.from("room-photos")
      .download(path);
    if (error) throw error;
    const cached = assets.current.get(path);
    if (cached) return cached;
    const url = URL.createObjectURL(data);
    assets.current.set(path, url);
    sourcePaths.current.set(url, path);
    return url;
  }, []);
  const layout =
    layouts.find((item) => item.id === room?.state.layout) ?? layouts[6];
  const photoKey = JSON.stringify(room?.state.photos);
  const portraitsPerSlot = room?.state.photoMode === "single" ? 1 : 2;
  const designKey =
    room?.state.phase === "capture" ? JSON.stringify(room.state.design) : "";
  const preparationKey = JSON.stringify([
    room?.state.phase,
    layout.id,
    portraitsPerSlot,
    photoKey,
    designKey,
  ]);
  // Photo preparation stays stable while collaborators edit the design.
  const prepared = preparation?.key === preparationKey ? preparation : null;
  useEffect(() => {
    if (
      !room ||
      (room.state.phase !== "capture" && room.state.phase !== "edit")
    ) {
      setPrepared(null);
      return;
    }
    const abort = new AbortController();
    const owned: string[] = [];
    setPrepared(null);
    const prepare = async () => {
      const photos: (string | null)[] = [];
      const cells = getCells(layout);
      for (let index = 0; index < getSlotCount(layout); index++) {
        if (portraitsPerSlot === 1) {
          const path = room.state.photos[index];
          photos.push(path ? await resolveAsset(path) : null);
          continue;
        }
        if (!room.state.photos[index * 2]) {
          photos.push(null);
          continue;
        }
        const pair = await Promise.all(
          room.state.photos.slice(index * 2, index * 2 + 2).map(resolveAsset),
        );
        const cell = cells[index];
        const aspect =
          ((layout.photoAspect ?? 1) * (cell.cols ?? 1)) / (cell.rows ?? 1);
        const blob = await composeRoomPhoto(pair, aspect, abort.signal);
        abort.signal.throwIfAborted();
        const url = URL.createObjectURL(blob);
        owned.push(url);
        photos.push(url);
      }
      const design =
        room.state.phase === "capture"
          ? (room.state.design ?? createDesign())
          : createDesign();
      const stickers = await Promise.all(
        design.stickers.map(async (sticker) => ({
          ...sticker,
          src: sticker.src.startsWith("/stickers/")
            ? sticker.src
            : await resolveAsset(sticker.src),
        })),
      );
      if (!abort.signal.aborted)
        setPrepared({
          key: preparationKey,
          photos,
          design: { ...design, stickers },
        });
    };
    void prepare().catch((cause) => {
      if (!abort.signal.aborted) setError(cause.message);
    });
    return () => {
      abort.abort();
      owned.forEach((url) => URL.revokeObjectURL(url));
    };
    // Only shared assets/layout/design require recomposition, not controller/presence updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparationKey, layout, resolveAsset]);
  const layoutAction = async (
    action: "continue" | "change" | "select" | "start",
    layoutId?: string,
  ) => {
    const snapshot = current.current!;
    if (action === "start") {
      accept(
        await roomRpc(client.current!, "ramon_start_single_capture", {
          room_code: snapshot.code,
          expected_revision: snapshot.revision,
        }),
      );
      return;
    }
    accept(
      await roomRpc(client.current!, "ramon_layout_action", {
        room_code: snapshot.code,
        expected_revision: snapshot.revision,
        action,
        layout_id: layoutId ?? null,
      }),
    );
  };
  useEffect(() => setConfirmLayout(false), [room?.state.phase]);
  const upload = useCallback(
    async (blob: Blob) => {
      const path = `${current.current!.code}/${user}/${crypto.randomUUID()}.${blob.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await client
        .current!.storage.from("room-photos")
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (error) throw error;
      return path;
    },
    [user],
  );
  const canonicalSource = useCallback(
    (src: string) => sourcePaths.current.get(src) ?? src,
    [],
  );
  const persistChanges = useCallback(
    async (changes: DesignChange[]) => {
      const sources = new Set<string>();
      for (const change of changes) {
        if (change.path[0] !== "stickers") continue;
        for (const value of [change.value, change.expected]) {
          const src =
            typeof value === "string" && change.path[2] === "src"
              ? value
              : value && typeof value === "object" && "src" in value
                ? String(value.src)
                : "";
          if (src.startsWith("blob:") && canonicalSource(src) === src)
            sources.add(src);
        }
      }
      for (const src of sources) {
        let pending = uploads.current.get(src);
        if (!pending) {
          pending = (async () => {
            const blob = await (await fetch(src)).blob();
            const path = await upload(blob);
            const url = URL.createObjectURL(blob);
            assets.current.set(path, url);
            sourcePaths.current.set(url, path);
            sourcePaths.current.set(src, path);
            return path;
          })();
          uploads.current.set(src, pending);
        }
        try {
          await pending;
        } catch (cause) {
          uploads.current.delete(src);
          throw cause;
        }
      }
      return changes.map((change) => ({
        ...mapChangeSources(change, canonicalSource),
        before: null,
      }));
    },
    [canonicalSource, upload],
  );
  const join = (create: boolean) =>
    run(async () => {
      if (!entryReady || (create && inviteCode !== null))
        throw new Error("Use Join room to accept this invitation.");
      const api = await connect();
      const next = await roomRpc(
        api,
        create ? "ramon_create_room" : "ramon_join_room",
        create
          ? { display_name: name.trim() }
          : {
              room_code: code.replace(/[^a-z0-9]/gi, "").toUpperCase(),
              display_name: name.trim(),
            },
      );
      sessionStorage.setItem("ramon-room", next.code);
      accept(next);
    });
  const other = room?.members.find((id) => id !== user);
  const sharedCount = room?.state.photos.length ?? 0;
  const submitted =
    portraitsPerSlot === 2 &&
    sharedCount % 2 === 1 &&
    room?.state.photos[sharedCount - 1].split("/")[1] === user;
  return (
    <div className="page-width together-page">
      <span className="eyebrow">A LITTLE CLOSER, EVEN FROM AFAR</span>
      <h1>A moment for two.</h1>
      <p>
        Keep your camera open, share a pose, and watch your memory come
        together.
      </p>
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="room-note" role="status">
          {notice}
        </p>
      )}
      {!room ? (
        <section className="room-card">
          <h2>
            {inviteCode !== null ? "Join your partner" : "Meet in a room"}
          </h2>
          {inviteCode !== null && (
            <p>
              You have been invited to room{" "}
              <strong>{inviteCode || "(invalid code)"}</strong>. Enter your name
              to join.
            </p>
          )}
          <label>
            Your name
            <input
              value={name}
              maxLength={32}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {entryReady && inviteCode === null && (
            <div className="room-actions">
              <button
                className="button button-primary"
                disabled={busy || !name.trim()}
                onClick={() => void join(true)}
              >
                Create room
              </button>
            </div>
          )}
          <label>
            Room code
            <input
              value={code}
              readOnly={inviteCode !== null}
              maxLength={16}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </label>
          <button
            className="button button-secondary"
            disabled={!entryReady || busy || !name.trim() || !code.trim()}
            onClick={() => void join(false)}
          >
            Join room
          </button>
          <p className="editor-hint">
            Up to two people. Approved photos are shared privately with your
            partner. Rooms expire after 24 hours. Keep this browser session to
            rejoin.
          </p>
        </section>
      ) : (
        <>
          <section className="room-card room-summary">
            <div>
              <h2>
                Room <strong>{room.code}</strong>
              </h2>
              <p>
                {room.names.join(" & ")} · {room.members.length}/2 people
              </p>
            </div>
            <div className="room-actions">
              {(room.state.phase === "capture" ||
                room.state.phase === "edit") && (
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => {
                    if (room.state.photos.length) setConfirmLayout(true);
                    else void run(() => layoutAction("change"));
                  }}
                >
                  Change layout
                </button>
              )}
              <button
                className="button button-secondary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(`${location.origin}/together?room=${room.code}`)
                    .then(() => setNotice("Invite link copied."))
                    .catch(() => setNotice(`Share room code ${room.code}`));
                }}
              >
                Copy invite
              </button>
              <button
                className="text-link"
                disabled={busy}
                onClick={() => {
                  current.current = null;
                  setRoom(null);
                  sessionStorage.removeItem("ramon-room");
                }}
              >
                Leave
              </button>
            </div>
          </section>
          {confirmLayout && (
            <div
              className="room-note"
              role="alertdialog"
              aria-labelledby="change-layout-title"
            >
              <h2 id="change-layout-title">Choose a different layout?</h2>
              <p>
                Photos and edits still syncing will be cleared for both of you.
                Your latest synced styling will be kept.
              </p>
              <div className="room-actions">
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await layoutAction("change");
                      setConfirmLayout(false);
                    })
                  }
                >
                  Change layout and clear photos
                </button>
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => setConfirmLayout(false)}
                >
                  Keep current layout
                </button>
              </div>
            </div>
          )}
          {room.state.phase === "lobby" && (
            <section className="room-card">
              <h2>
                {other ? "You’re both here." : "Waiting for your partner."}
              </h2>
              <p>
                {other
                  ? "Continue together to find your favourite layout."
                  : "Copy the invite link above and send it to your partner."}
              </p>
              <button
                className="button button-primary"
                disabled={!other || busy}
                onClick={() => void run(() => layoutAction("continue"))}
              >
                Continue
              </button>
            </section>
          )}
          {room.state.phase === "layout" && (
            <section className="room-card">
              <div className="panel-heading">
                <span className="panel-kicker">
                  EVERY MEMORY NEEDS A LITTLE FRAME
                </span>
                <h2>Find your favourite shape.</h2>
                <p>
                  Both of you can choose. Your selection appears on your
                  partner’s screen.
                </p>
              </div>
              <fieldset disabled={busy} className="room-control-group">
                <LayoutGallery
                  selectedLayout={room.state.layoutChosen ? layout : null}
                  onSelectLayout={(choice) =>
                    void run(() => layoutAction("select", choice.id))
                  }
                  description="One photo per slot. Either of you can fill the next space."
                  actions={
                    <div className="summary-actions">
                      <button
                        className="button button-primary"
                        disabled={!room.state.layoutChosen || busy}
                        onClick={() => void run(() => layoutAction("start"))}
                      >
                        Start taking photos
                      </button>
                    </div>
                  }
                />
              </fieldset>
            </section>
          )}
          {room.state.phase === "capture" && (
            <section className="room-card room-capture-workspace">
              <div className="room-capture-camera">
                <h2>
                  Photo{" "}
                  {Math.floor(room.state.photos.length / portraitsPerSlot) + 1}{" "}
                  of {getSlotCount(layout)}
                </h2>
                <p>
                  {submitted
                    ? "Your portrait is in this slot. Your camera stays open while your partner adds theirs."
                    : "Both cameras are ready to use. Whoever shares first fills the next empty slot."}
                </p>
                <p>
                  {room.state.photos.length} of{" "}
                  {getSlotCount(layout) * portraitsPerSlot} photos shared
                </p>
                <RoomCamera
                  key={room.state.captureId ?? "legacy"}
                  disabled={busy || submitted}
                  onUse={async (blob) => {
                    if (locked.current)
                      throw new Error("Please wait for the current action.");
                    locked.current = true;
                    setBusy(true);
                    const shot = current.current!;
                    try {
                      // Keep uploaded files after an ambiguous network failure:
                      // the server may already have accepted the submission.
                      const path = await upload(blob);
                      accept(
                        await roomRpc(
                          client.current!,
                          portraitsPerSlot === 1
                            ? "ramon_submit_single_photo"
                            : "ramon_submit_photo",
                          {
                            room_code: shot.code,
                            photo_path: path,
                            ...(portraitsPerSlot === 2
                              ? {
                                  pair_index: Math.floor(
                                    shot.state.photos.length / 2,
                                  ),
                                }
                              : {}),
                            capture_id: shot.state.captureId ?? "",
                          },
                        ),
                      );
                    } finally {
                      locked.current = false;
                      setBusy(false);
                    }
                  }}
                />
              </div>
              <div className="room-capture-preview">
                <h2>Your shared photobooth</h2>
                <p className="editor-hint">
                  {portraitsPerSlot === 1
                    ? "Each slot holds one photo. New photos appear here as they arrive."
                    : "This older session uses paired portraits. Use Change layout to start one photo per slot."}
                </p>
                <div className="preview-stage">
                  <PhotostripPreview
                    layout={layout}
                    images={
                      prepared?.photos ?? Array(getSlotCount(layout)).fill(null)
                    }
                    design={prepared?.design ?? createDesign()}
                    selected={null}
                    onSelect={() => {}}
                    onUpdateSticker={() => {}}
                    onRemoveSticker={() => {}}
                    onBegin={() => {}}
                    onEnd={() => {}}
                  />
                </div>
                <p role="status">
                  {prepared
                    ? `${sharedCount} photos in the layout`
                    : "Updating preview…"}
                </p>
              </div>
            </section>
          )}
          {room.state.phase === "edit" &&
            (prepared ? (
              <RoomEditor
                key={room.code + (room.state.captureId ?? "legacy") + photoKey}
                layout={layout}
                images={prepared.photos}
                room={room}
                client={client.current!}
                busy={busy}
                onRoom={accept}
                canonicalSource={canonicalSource}
                persistChanges={persistChanges}
                resolveAsset={resolveAsset}
                live={live}
                onRetake={() =>
                  run(async () => {
                    const snapshot = current.current!;
                    accept(
                      await roomRpc(client.current!, "ramon_retake_photo", {
                        room_code: snapshot.code,
                        expected_revision: snapshot.revision,
                      }),
                    );
                  })
                }
                retakeCount={portraitsPerSlot}
              />
            ) : (
              <p role="status">Putting your portraits together…</p>
            ))}
        </>
      )}
    </div>
  );
}
