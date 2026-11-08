"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyDesignChanges,
  coalesceChanges,
  diffDesign,
  inverseChanges,
  mapChangeSources,
  roomDesign,
  type DesignChange,
} from "@/lib/room-design";
import {
  sessionReducer,
  createSession,
  type SessionAction,
} from "@/lib/photobooth-session";
import type { EditorDesign } from "@/lib/editor-design";
import { roomRpc, type Room, type RoomClient } from "@/lib/room-client";

interface Batch {
  id: string;
  changes: DesignChange[];
  wire?: DesignChange[];
}
interface Options {
  room: Room;
  client: RoomClient;
  onRoom: (room: Room) => void;
  canonicalSource: (source: string) => string;
  persistChanges: (changes: DesignChange[]) => Promise<DesignChange[]>;
}

export function useRoomDesign({
  room,
  client,
  onRoom,
  canonicalSource,
  persistChanges,
}: Options) {
  const base = useRef({
    revision: room.revision,
    design: roomDesign(room.state.design),
  });
  const pending = useRef<Batch[]>([]);
  const history = useRef<{
    past: DesignChange[][];
    future: DesignChange[][];
    transaction: DesignChange[] | null;
  }>({ past: [], future: [], transaction: null });
  const [view, setView] = useState({
    design: base.current.design,
    canUndo: false,
    canRedo: false,
  });
  const local = useRef(view.design);
  const [status, setStatus] = useState("All changes saved");
  const [syncError, setSyncError] = useState("");
  const active = useRef(false);
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureId = room.state.captureId ?? "";
  const normalize = useCallback(
    (changes: readonly DesignChange[]) =>
      changes.map((change) => mapChangeSources(change, canonicalSource)),
    [canonicalSource],
  );
  const render = useCallback(() => {
    const next = pending.current.reduce(
      (design, batch) => applyDesignChanges(design, normalize(batch.changes)),
      base.current.design,
    );
    // An acknowledgement often repeats the optimistic preview. Keep its identity
    // so exports are encoded only when the visible design actually changes.
    if (diffDesign(local.current, next).length) local.current = next;
    if (active.current)
      setView({
        design: local.current,
        canUndo: !!history.current.past.length,
        canRedo: !!history.current.future.length,
      });
  }, [normalize]);
  const receive = useCallback(
    (next: Room) => {
      if (next.revision > base.current.revision) {
        base.current = {
          revision: next.revision,
          design: roomDesign(next.state.design),
        };
      }
      render();
    },
    [render],
  );

  const drain = useCallback(() => {
    if (running.current) return running.current;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const work = async () => {
      while (active.current && pending.current.length) {
        const batch = pending.current[0];
        setStatus("Saving changes…");
        // Keep both the operation ID and uploaded paths stable across retries.
        batch.wire ??= await persistChanges(normalize(batch.changes));
        const next = await roomRpc(client, "ramon_apply_design", {
          room_code: room.code,
          capture_id: captureId,
          operation_id: batch.id,
          changes: batch.wire,
        });
        if (!active.current) return;
        pending.current.shift();
        receive(next);
        onRoom(next);
        setSyncError("");
      }
      if (active.current) setStatus("All changes saved");
    };
    running.current = work()
      .catch((cause) => {
        if (active.current) {
          setStatus("Changes waiting to sync");
          setSyncError(
            cause instanceof Error
              ? cause.message
              : "Connection interrupted. Retrying…",
          );
          throw cause;
        }
      })
      .finally(() => {
        running.current = null;
      });
    return running.current;
  }, [
    captureId,
    client,
    normalize,
    onRoom,
    persistChanges,
    receive,
    room.code,
  ]);

  useEffect(() => {
    active.current = true;
    const retry = () => {
      if (pending.current.length) void drain().catch(() => {});
    };
    const interval = setInterval(retry, 3000);
    const leaving = (event: BeforeUnloadEvent) => {
      if (pending.current.length) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("online", retry);
    window.addEventListener("beforeunload", leaving);
    return () => {
      active.current = false;
      clearInterval(interval);
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("online", retry);
      window.removeEventListener("beforeunload", leaving);
    };
  }, [drain]);
  useEffect(() => {
    receive(room);
  }, [receive, room]);

  const enqueue = (changes: DesignChange[]) => {
    if (!changes.length) return;
    // Unsent edits share a small batch. An in-flight batch remains immutable.
    const last = pending.current.at(-1);
    if (
      last &&
      last !== pending.current[0] &&
      last.changes.length + changes.length <= 96
    ) {
      const combined = [...last.changes, ...changes];
      last.changes = combined.some((change) => "expected" in change)
        ? combined
        : coalesceChanges(combined);
      if (!last.changes.length) pending.current.pop();
    } else pending.current.push({ id: crypto.randomUUID(), changes });
    render();
    setStatus("Saving changes…");
    if (!timer.current)
      timer.current = setTimeout(() => {
        timer.current = null;
        void drain().catch(() => {});
      }, 150);
  };
  const dispatch = (action: SessionAction) => {
    const stack = history.current;
    if (action.type === "design-begin") {
      stack.transaction ??= [];
      return;
    }
    if (action.type === "design-end") {
      const changes = coalesceChanges(stack.transaction ?? []);
      if (changes.length) stack.past = [...stack.past, changes].slice(-30);
      stack.transaction = null;
      render();
      return;
    }
    if (action.type === "undo" || action.type === "redo") {
      const source = action.type === "undo" ? stack.past : stack.future;
      const group = source.pop();
      if (!group) return;
      const changes = inverseChanges(normalize(group));
      const after = applyDesignChanges(local.current, changes);
      const applied = diffDesign(local.current, after);
      const destination = action.type === "undo" ? stack.future : stack.past;
      if (applied.length) destination.push(applied);
      // Expected values also protect against a remote write arriving mid-undo.
      enqueue(changes);
      render();
      return;
    }
    if (action.type !== "design") return;
    const patch = { ...action.patch };
    if (patch.stickers)
      patch.stickers = patch.stickers.map((sticker) => ({
        ...sticker,
        src: canonicalSource(sticker.src),
      }));
    const next = sessionReducer(
      { ...createSession(), design: view.design },
      { type: "design", patch },
    ).design;
    const changes = diffDesign(view.design, next);
    if (!changes.length) return;
    stack.future = [];
    if (stack.transaction) stack.transaction.push(...changes);
    else stack.past = [...stack.past, changes].slice(-30);
    enqueue(changes);
  };
  const flush = async () => {
    while (active.current && pending.current.length) await drain();
    if (!active.current) throw new Error("The photo session changed.");
  };
  const sources = [
    view.design,
    ...[
      ...history.current.past,
      ...history.current.future,
      history.current.transaction ?? [],
      ...pending.current.map((batch) => batch.changes),
    ]
      .flat()
      .flatMap((change) => [change.value, change.before]),
  ].flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    if ("stickers" in value)
      return (value as EditorDesign).stickers.map((sticker) => sticker.src);
    return "src" in value ? [String(value.src)] : [];
  });
  return {
    ...view,
    status,
    syncError,
    dispatch,
    flush,
    sources,
    retry: () => void drain().catch(() => {}),
  };
}
