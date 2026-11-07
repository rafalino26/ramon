"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRoomClient,
  roomIdentity,
  roomRpc,
  saveRoom,
  type Room,
  type RoomClient,
  type RoomState,
} from "@/lib/room-client";
import { layouts, getSlotCount, getCells } from "@/lib/layout";
import { createDesign, type EditorDesign } from "@/lib/editor-design";
import { composeRoomPhoto } from "@/lib/room-collage";
import RoomCamera from "./RoomCamera";
import RoomEditor from "./RoomEditor";
import PhotostripPreview from "../components/photostrip";

export default function Together() {
  const client = useRef<RoomClient | null>(null);
  const [user, setUser] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const current = useRef<Room | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const assets = useRef(new Map<string, string>());
  const [prepared, setPrepared] = useState<{
    photos: (string | null)[];
    design: EditorDesign;
  } | null>(null);
  const accept = useCallback((next: Room) => {
    if (
      !current.current ||
      current.current.code !== next.code ||
      next.revision >= current.current.revision
    ) {
      current.current = next;
      setRoom(next);
    }
  }, []);
  useEffect(() => {
    const cache = assets.current;
    setCode(
      new URLSearchParams(location.search).get("room") ??
        sessionStorage.getItem("ramon-room") ??
        "",
    );
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
      if (active) timer = setTimeout(poll, document.hidden ? 15000 : 2000);
    };
    timer = setTimeout(poll, 2000);
    return () => {
      active = false;
      clearTimeout(timer);
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
    return url;
  }, []);
  const layout =
    layouts.find((item) => item.id === room?.state.layout) ?? layouts[6];
  const photoKey = JSON.stringify(room?.state.photos);
  const designKey = JSON.stringify(room?.state.design);
  useEffect(() => {
    if (!room || room.state.phase === "lobby") {
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
      const design = room.state.design ?? createDesign();
      const stickers = await Promise.all(
        design.stickers.map(async (sticker) => ({
          ...sticker,
          src: sticker.src.startsWith("/stickers/")
            ? sticker.src
            : await resolveAsset(sticker.src),
        })),
      );
      if (!abort.signal.aborted)
        setPrepared({ photos, design: { ...design, stickers } });
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
  }, [photoKey, designKey, room?.state.phase, layout, resolveAsset]);
  const update = async (state: RoomState, editor = current.current!.editor) =>
    accept(await saveRoom(client.current!, current.current!, state, editor));
  const upload = async (blob: Blob) => {
    const path = `${current.current!.code}/${user}/${crypto.randomUUID()}.${blob.type === "image/png" ? "png" : "jpg"}`;
    const { error } = await client
      .current!.storage.from("room-photos")
      .upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    return path;
  };
  const publish = async (design: EditorDesign, pass: boolean) =>
    run(async () => {
      const stickers = [];
      for (const sticker of design.stickers) {
        let src = sticker.src;
        if (!src.startsWith("/stickers/")) {
          const existing = [...assets.current.entries()].find(
            ([, url]) => url === src,
          )?.[0];
          if (existing) src = existing;
          else {
            const blob = await (await fetch(src)).blob();
            src = await upload(blob);
            assets.current.set(src, URL.createObjectURL(blob));
          }
        }
        stickers.push({ ...sticker, src });
      }
      const nextEditor = pass
        ? current.current!.members.find((id) => id !== user)!
        : user;
      await update(
        { ...current.current!.state, design: { ...design, stickers } },
        nextEditor,
      );
      setNotice(
        pass
          ? "Control passed to your partner."
          : "Design shared with your partner.",
      );
    });
  const join = (create: boolean) =>
    run(async () => {
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
  const mine = room?.editor === user;
  const other = room?.members.find((id) => id !== user);
  const sharedCount = room?.state.photos.length ?? 0;
  const submitted =
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
          <h2>Meet in a room</h2>
          <label>
            Your name
            <input
              value={name}
              maxLength={32}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="room-actions">
            <button
              className="button button-primary"
              disabled={busy || !name.trim()}
              onClick={() => void join(true)}
            >
              Create room
            </button>
          </div>
          <label>
            Room code
            <input
              value={code}
              maxLength={16}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </label>
          <button
            className="button button-secondary"
            disabled={busy || !name.trim() || !code.trim()}
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
          {room.state.phase === "lobby" && (
            <section className="room-card">
              <h2>Choose your layout</h2>
              <p>
                {other
                  ? "You are both here. Each photo slot will contain a portrait from each of you."
                  : "Share the room code and wait for your partner to join."}
              </p>
              <label>
                Layout
                <select
                  aria-label="Room layout"
                  disabled={!mine || busy}
                  value={layout.id}
                  onChange={(event) => {
                    const id = event.target.value;
                    void run(() =>
                      update({ ...current.current!.state, layout: id }),
                    );
                  }}
                >
                  {layouts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} · {getSlotCount(item)} paired photos
                    </option>
                  ))}
                </select>
              </label>
              {mine && (
                <button
                  className="button button-primary"
                  disabled={!other || busy}
                  onClick={() =>
                    void run(() =>
                      update({
                        ...current.current!.state,
                        phase: "capture",
                        photos: [],
                        captureId: crypto.randomUUID(),
                      }),
                    )
                  }
                >
                  Start taking photos
                </button>
              )}
            </section>
          )}
          {room.state.phase === "capture" && (
            <section className="room-card room-capture-workspace">
              <div className="room-capture-camera">
                <h2>
                  Photo {Math.floor(room.state.photos.length / 2) + 1} of{" "}
                  {getSlotCount(layout)}
                </h2>
                <p>
                  {submitted
                    ? "Your portrait is in this slot. Your camera stays open while your partner adds theirs."
                    : "Both cameras are ready to use. Whoever shares first appears first in this pair."}
                </p>
                <p>
                  {room.state.photos.length} of {getSlotCount(layout) * 2}{" "}
                  portraits shared
                </p>
                <RoomCamera
                  key={room.state.captureId ?? "legacy"}
                  disabled={busy || submitted}
                  onUse={async (blob) => {
                    if (locked.current)
                      throw new Error("Please wait for the current action.");
                    locked.current = true;
                    setBusy(true);
                    let path: string | null = null;
                    const shot = current.current!;
                    try {
                      path = await upload(blob);
                      accept(
                        await roomRpc(client.current!, "ramon_submit_photo", {
                          room_code: shot.code,
                          photo_path: path,
                          pair_index: Math.floor(shot.state.photos.length / 2),
                          capture_id: shot.state.captureId ?? "",
                        }),
                      );
                    } catch (cause) {
                      if (path)
                        await client
                          .current!.storage.from("room-photos")
                          .remove([path]);
                      throw cause;
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
                  One portrait from each person in every slot. New photos appear
                  here as they arrive.
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
                    ? `${sharedCount} portraits in the layout`
                    : "Updating preview…"}
                </p>
              </div>
            </section>
          )}
          {room.state.phase === "edit" &&
            (prepared ? (
              <RoomEditor
                key={room.editor + photoKey}
                layout={layout}
                images={prepared.photos}
                design={prepared.design}
                controller={!!mine}
                busy={busy}
                onPublish={publish}
                onRetake={() => {
                  void run(() =>
                    update(
                      {
                        ...current.current!.state,
                        phase: "capture",
                        photos: current.current!.state.photos.slice(0, -2),
                        captureId: crypto.randomUUID(),
                      },
                      current.current!.members[0],
                    ),
                  );
                }}
              />
            ) : (
              <p role="status">Putting your portraits together…</p>
            ))}
        </>
      )}
    </div>
  );
}
