"use client";
import { useEffect, useMemo, useState } from "react";
import { getCells, getSlotCount, type LayoutInfo } from "@/lib/layout";
import { composeRoomPhoto } from "@/lib/room-collage";
import type { Room } from "@/lib/room-client";

export function useRoomPhotos(
  room: Room,
  layout: LayoutInfo,
  resolveAsset: (path: string) => Promise<string>,
) {
  const pathsKey = JSON.stringify(room.state.photos);
  const single = room.state.photoMode === "single";
  const keys = useMemo(() => {
    const paths = JSON.parse(pathsKey) as (string | null)[];
    return Array.from({ length: getSlotCount(layout) }, (_, index) => {
      return single
        ? (paths[index] ?? "")
        : paths[index * 2]
          ? JSON.stringify(paths.slice(index * 2, index * 2 + 2))
          : "";
    });
  }, [pathsKey, single, layout]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    const owned: string[] = [];
    const load = async () => {
      try {
        const entries = await Promise.all(
          keys.map(async (key, index) => {
            if (!key) return [key, ""] as const;
            if (single) return [key, await resolveAsset(key)] as const;
            const paths = JSON.parse(key) as string[];
            const pair = await Promise.all(
              paths.filter(Boolean).map(resolveAsset),
            );
            const cell = getCells(layout)[index];
            const blob = await composeRoomPhoto(
              pair,
              ((layout.photoAspect ?? 1) * (cell.cols ?? 1)) / (cell.rows ?? 1),
              abort.signal,
            );
            abort.signal.throwIfAborted();
            const url = URL.createObjectURL(blob);
            owned.push(url);
            return [key, url] as const;
          }),
        );
        if (active) {
          setUrls((previous) => ({
            ...previous,
            ...Object.fromEntries(entries),
          }));
          setError("");
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Photos could not be loaded.",
          );
          retry = setTimeout(load, 3000);
        }
      }
    };
    void load();
    return () => {
      active = false;
      abort.abort();
      clearTimeout(retry);
      owned.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [keys, layout, resolveAsset, single]);
  const images = useMemo(
    () => keys.map((key) => (key ? (urls[key] ?? null) : null)),
    [keys, urls],
  );
  return { images, ready: keys.every((key) => !key || !!urls[key]), error };
}
