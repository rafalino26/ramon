"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRoomClient,
  roomIdentity,
  roomRpc,
  type Room,
  type RoomClient,
} from "@/lib/room-client";
import { layouts } from "@/lib/layout";
import { mapChangeSources, type DesignChange } from "@/lib/room-design";
import RoomStudio from "./RoomStudio";
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
                    if (room.state.photos.some(Boolean)) setConfirmLayout(true);
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
          {(room.state.phase === "capture" || room.state.phase === "edit") && (
            <RoomStudio
              key={room.code + (room.state.captureId ?? "legacy")}
              room={room}
              user={user}
              client={client.current!}
              layout={layout}
              busy={busy}
              live={live}
              onRoom={accept}
              upload={upload}
              resolveAsset={resolveAsset}
              canonicalSource={canonicalSource}
              persistChanges={persistChanges}
            />
          )}
        </>
      )}
    </div>
  );
}
