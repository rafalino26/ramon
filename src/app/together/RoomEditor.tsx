"use client";
import { useEffect, useMemo, useState } from "react";
import { FiCamera } from "react-icons/fi";
import type { EditorDesign } from "@/lib/editor-design";
import Edit from "../components/edit";
import { createSession } from "@/lib/photobooth-session";
import type { LayoutInfo } from "@/lib/layout";
import type { Room, RoomClient } from "@/lib/room-client";
import type { DesignChange } from "@/lib/room-design";
import { usePhotoUrls } from "@/hooks/use-photo-urls";
import { useRoomDesign } from "@/hooks/use-room-design";

export default function RoomEditor({
  layout,
  images,
  room,
  client,
  busy,
  onRoom,
  canonicalSource,
  persistChanges,
  resolveAsset,
  onRetake,
  live,
  active = true,
  photosReady = true,
  onPreview,
  retakeCount = 1,
}: {
  layout: LayoutInfo;
  images: (string | null)[];
  room: Room;
  client: RoomClient;
  busy: boolean;
  live: boolean;
  active?: boolean;
  photosReady?: boolean;
  onPreview?: (design: EditorDesign) => void;
  onRoom: (room: Room) => void;
  canonicalSource: (source: string) => string;
  persistChanges: (changes: DesignChange[]) => Promise<DesignChange[]>;
  resolveAsset: (source: string) => Promise<string>;
  onRetake: () => Promise<void>;
  retakeCount?: number;
}) {
  const collaboration = useRoomDesign({
    room,
    client,
    onRoom,
    canonicalSource,
    persistChanges,
  });
  const createSource = usePhotoUrls(collaboration.sources);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [assetError, setAssetError] = useState("");
  const sourcesKey = JSON.stringify(
    collaboration.design.stickers.map((sticker) => sticker.src),
  );
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout>;
    const sources = JSON.parse(sourcesKey) as string[];
    const load = () =>
      void Promise.all(
        sources
          .filter(
            (source) =>
              !source.startsWith("/stickers/") && !source.startsWith("blob:"),
          )
          .map(async (source) => [source, await resolveAsset(source)] as const),
      )
        .then((entries) => {
          if (active) {
            setUrls((previous) => ({
              ...previous,
              ...Object.fromEntries(entries),
            }));
            setAssetError("");
          }
        })
        .catch((cause) => {
          if (active) {
            setAssetError(cause.message);
            retry = setTimeout(load, 3000);
          }
        });
    load();
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [sourcesKey, resolveAsset]);
  const design = useMemo(
    () => ({
      ...collaboration.design,
      stickers: collaboration.design.stickers.map((sticker) => ({
        ...sticker,
        src: urls[sticker.src] ?? sticker.src,
      })),
    }),
    [collaboration.design, urls],
  );
  const assetsReady = design.stickers.every(
    (sticker) =>
      sticker.src.startsWith("/stickers/") || sticker.src.startsWith("blob:"),
  );
  useEffect(() => {
    onPreview?.(design);
  }, [design, onPreview]);
  return (
    <>
      <div className="room-note">
        <p>Make it yours, together. Both of you can edit this photobooth.</p>
        <p role="status" data-testid="design-sync-status">
          {live ? "Live" : "Connecting…"} · {collaboration.status}
        </p>
        {photosReady &&
          images.some(Boolean) &&
          images.some((image) => !image) && (
            <p className="editor-hint">
              Empty photo spaces will stay blank in your download.
            </p>
          )}
        {(collaboration.syncError || assetError) && (
          <p role="alert" className="notice-error">
            {collaboration.syncError || assetError}
          </p>
        )}
        {collaboration.syncError && (
          <button className="text-link" onClick={collaboration.retry}>
            Retry sync
          </button>
        )}
      </div>
      <div className="room-actions">
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => void onRetake()}
        >
          <FiCamera />
          {retakeCount === 1 ? "Retake the last photo" : "Retake the last pair"}
        </button>
      </div>
      <Edit
        session={{
          ...createSession(),
          layout,
          images,
          design,
          hasSelectedLayout: true,
        }}
        dispatch={collaboration.dispatch}
        history={{
          canUndo: collaboration.canUndo,
          canRedo: collaboration.canRedo,
        }}
        assetsReady={assetsReady && photosReady}
        active={active}
        createStickerSource={createSource}
        onChooseLayout={() => void onRetake()}
        readOnly={busy || !active}
      />
    </>
  );
}
