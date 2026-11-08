"use client";
import { useEffect, useRef, useState } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCamera,
  FiEdit3,
  FiRotateCcw,
  FiRotateCw,
  FiTrash2,
} from "react-icons/fi";
import type { Room, RoomClient } from "@/lib/room-client";
import { roomRpc } from "@/lib/room-client";
import { createDesign, type EditorDesign } from "@/lib/editor-design";
import type { DesignChange } from "@/lib/room-design";
import { getSlotCount, type LayoutInfo } from "@/lib/layout";
import { useRoomPhotos } from "@/hooks/use-room-photos";
import PhotostripPreview from "../components/photostrip";
import RoomCamera from "./RoomCamera";
import RoomEditor from "./RoomEditor";

export default function RoomStudio({
  room,
  user,
  client,
  layout,
  busy,
  live,
  onRoom,
  upload,
  resolveAsset,
  canonicalSource,
  persistChanges,
}: {
  room: Room;
  user: string;
  client: RoomClient;
  layout: LayoutInfo;
  busy: boolean;
  live: boolean;
  onRoom: (room: Room) => void;
  upload: (blob: Blob) => Promise<string>;
  resolveAsset: (path: string) => Promise<string>;
  canonicalSource: (src: string) => string;
  persistChanges: (changes: DesignChange[]) => Promise<DesignChange[]>;
}) {
  const {
    images,
    ready,
    error: photoError,
  } = useRoomPhotos(room, layout, resolveAsset);
  const total = getSlotCount(layout);
  const single = room.state.photoMode === "single";
  const count = single
    ? room.state.photos.filter(Boolean).length
    : Math.ceil(room.state.photos.filter(Boolean).length / 2);
  const [tab, setTab] = useState<"photos" | "decorate">(
    count === total ? "decorate" : "photos",
  );
  const previousCount = useRef(count);
  const [selected, setSelected] = useState<{
    index: number;
    expected: string | null;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clearSnapshot, setClearSnapshot] = useState<(string | null)[] | null>(
    null,
  );
  const [previewDesign, setPreviewDesign] =
    useState<EditorDesign>(createDesign);
  const lock = useRef(false);
  const submissions = useRef(
    new WeakMap<Blob, Map<string, { path: string; id: string }>>(),
  );
  const history = room.state.photoHistory?.[user];
  const disabled = busy || working;
  useEffect(() => {
    if (previousCount.current < total && count === total) setTab("decorate");
    previousCount.current = count;
  }, [count, total]);

  const mutate = async (action: string, args: Record<string, unknown> = {}) => {
    if (lock.current)
      throw new Error("Please wait for the photo to finish sharing.");
    lock.current = true;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const next = await roomRpc(client, "ramon_photo_action", {
        room_code: room.code,
        capture_id: room.state.captureId ?? "",
        operation_id: crypto.randomUUID(),
        action,
        ...args,
      });
      onRoom(next);
      if (
        (action === "undo" || action === "redo") &&
        JSON.stringify(next.state.photos) === JSON.stringify(room.state.photos)
      )
        setNotice(
          "Your partner has already updated those photos. Their changes were kept.",
        );
      return next;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The photo could not be updated.",
      );
      throw cause;
    } finally {
      lock.current = false;
      setWorking(false);
    }
  };
  const choose = (index: number) => {
    setSelected({ index, expected: room.state.photos[index] ?? null });
    setError("");
    setNotice("");
    setTab("photos");
  };
  const share = async (blob: Blob) => {
    if (lock.current) throw new Error("Please wait for the current photo.");
    lock.current = true;
    setWorking(true);
    setError("");
    const target = selected;
    const key = `${room.state.captureId}:${target ? `${target.index}:${target.expected}` : "auto"}`;
    let record = submissions.current.get(blob)?.get(key);
    try {
      if (!record) {
        record = { path: await upload(blob), id: crypto.randomUUID() };
        const entries = submissions.current.get(blob) ?? new Map();
        entries.set(key, record);
        submissions.current.set(blob, entries);
      }
      const next = await roomRpc(
        client,
        single ? "ramon_photo_action" : "ramon_submit_photo",
        single
          ? {
              room_code: room.code,
              capture_id: room.state.captureId ?? "",
              operation_id: record.id,
              action: "set",
              target_slot: target?.index ?? -1,
              expected_photo: target?.expected ?? null,
              photo_path: record.path,
            }
          : {
              room_code: room.code,
              capture_id: room.state.captureId ?? "",
              photo_path: record.path,
              pair_index: Math.floor(room.state.photos.length / 2),
            },
      );
      onRoom(next);
      setSelected(null);
      setNotice("Photo shared with your partner.");
      if (target) setTab("decorate");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your photo could not be shared. Try again.",
      );
      throw cause;
    } finally {
      lock.current = false;
      setWorking(false);
    }
  };
  const lastPhoto = single ? room.state.photos.findLastIndex(Boolean) : -1;
  const automaticSlot = images.findIndex((image) => !image);
  const targetLabel = selected
    ? `Photo ${selected.index + 1}`
    : automaticSlot >= 0
      ? `Photo ${automaticSlot + 1} of ${total}`
      : "All photos are here";
  return (
    <section className="room-studio" aria-label="Shared photobooth workspace">
      <div className="room-card room-photo-manager">
        <div className="room-photo-heading">
          <div>
            <span className="panel-kicker">YOUR SHARED MOMENTS</span>
            <h2>Your photos, your way.</h2>
            <p>
              <span data-testid="room-photo-count">
                {count} of {total} photos shared
              </span>{" "}
              · Select any photo to retake it.
            </p>
          </div>
          {single && (
            <div
              className="room-actions room-photo-history"
              aria-label="Photo history"
            >
              <button
                className="button button-secondary"
                disabled={disabled || !history?.undo}
                onClick={() => void mutate("undo").catch(() => {})}
              >
                <FiRotateCcw /> Undo photo
              </button>
              <button
                className="button button-secondary"
                disabled={disabled || !history?.redo}
                onClick={() => void mutate("redo").catch(() => {})}
              >
                <FiRotateCw /> Redo photo
              </button>
              <button
                className="button button-secondary"
                disabled={disabled || !count}
                onClick={() => setClearSnapshot([...room.state.photos])}
              >
                <FiTrash2 /> Clear photos
              </button>
            </div>
          )}
        </div>
        <div className="room-photo-slots" aria-label="Shared photo slots">
          {images.map((image, index) => {
            const filled = !!room.state.photos[single ? index : index * 2];
            return (
              <div
                key={index}
                className={`room-photo-tile ${selected?.index === index ? "is-selected" : ""}`}
                data-room-photo-slot={index}
              >
                <button
                  className="room-photo-select"
                  disabled={disabled || !single || (filled && !image)}
                  aria-label={
                    filled
                      ? `Retake photo ${index + 1}`
                      : `Fill photo ${index + 1}`
                  }
                  aria-pressed={selected?.index === index}
                  aria-busy={filled && !image}
                  onClick={() => choose(index)}
                >
                  {image ? (
                    <img src={image} alt={`Shared photo ${index + 1}`} />
                  ) : (
                    <span>
                      <FiCamera />
                      <small>{filled ? "Loading photo…" : "Add a photo"}</small>
                    </span>
                  )}
                  <strong>{index + 1}</strong>
                </button>
                {single && room.state.photos[index] && (
                  <button
                    className="room-delete-photo"
                    aria-label={`Delete photo ${index + 1}`}
                    disabled={disabled || !ready}
                    onClick={() =>
                      void mutate("remove", {
                        target_slot: index,
                        expected_photo: room.state.photos[index],
                      })
                        .then(() => {
                          setSelected({ index, expected: null });
                          setTab("photos");
                        })
                        .catch(() => {})
                    }
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {selected && (
          <div className="room-selected-photo">
            <p>
              <strong>Photo {selected.index + 1} selected.</strong>{" "}
              {selected.expected
                ? "Your current photo stays until you share its replacement."
                : "Your next photo goes into this space."}
            </p>
            {(room.state.photos[selected.index] ?? null) !==
              selected.expected && (
              <p role="status">
                Your partner updated this slot. Select its thumbnail again to
                use the latest photo.
              </p>
            )}
            <div className="room-actions">
              {selected.expected &&
                [-1, 1].map((direction) => (
                  <button
                    key={direction}
                    className="button button-secondary"
                    disabled={
                      disabled ||
                      !ready ||
                      (room.state.photos[selected.index] ?? null) !==
                        selected.expected ||
                      selected.index + direction < 0 ||
                      selected.index + direction >= total
                    }
                    onClick={() => {
                      const other = selected.index + direction;
                      void mutate("swap", {
                        target_slot: selected.index,
                        expected_photo: selected.expected,
                        other_slot: other,
                        other_expected: room.state.photos[other] ?? null,
                      })
                        .then(() => setSelected(null))
                        .catch(() => {});
                    }}
                  >
                    {direction < 0 ? <FiArrowLeft /> : <FiArrowRight />}
                    {direction < 0 ? "Move earlier" : "Move later"}
                  </button>
                ))}
              <button
                className="button button-secondary"
                disabled={disabled}
                onClick={() => setSelected(null)}
              >
                Cancel selection
              </button>
            </div>
          </div>
        )}
        {clearSnapshot && (
          <div
            className="room-note"
            role="alertdialog"
            aria-labelledby="clear-photos-title"
          >
            <h3 id="clear-photos-title">Clear your shared photos?</h3>
            <p>
              Your styling stays. You can restore unchanged slots with Undo
              photo.
            </p>
            <div className="room-actions">
              <button
                className="button button-primary"
                disabled={disabled}
                onClick={() =>
                  void mutate("clear", { expected_photos: clearSnapshot })
                    .then(() => {
                      setClearSnapshot(null);
                      setSelected(null);
                      setTab("photos");
                    })
                    .catch(() => setClearSnapshot(null))
                }
              >
                Clear all photos
              </button>
              <button
                className="button button-secondary"
                disabled={disabled}
                onClick={() => setClearSnapshot(null)}
              >
                Keep photos
              </button>
            </div>
          </div>
        )}
        {(error || photoError) && (
          <p role="alert" className="notice-error">
            {error || photoError}
          </p>
        )}
        {notice && (
          <p role="status" className="room-photo-notice">
            {notice}
          </p>
        )}
      </div>
      <div
        className="room-studio-tabs"
        role="tablist"
        aria-label="Photobooth tools"
      >
        <button
          role="tab"
          aria-selected={tab === "photos"}
          aria-controls="room-photos-panel"
          id="room-photos-tab"
          onClick={() => setTab("photos")}
        >
          <FiCamera /> Camera & photos{" "}
          <span>
            {count}/{total}
          </span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "decorate"}
          aria-controls="room-design-panel"
          id="room-design-tab"
          onClick={() => setTab("decorate")}
        >
          <FiEdit3 /> Decorate together
        </button>
      </div>
      <div
        id="room-photos-panel"
        role="tabpanel"
        aria-labelledby="room-photos-tab"
        hidden={tab !== "photos"}
      >
        <div className="room-card room-capture-workspace">
          <div className="room-capture-camera">
            <h2>{targetLabel}</h2>
            <p className="editor-hint">
              Both cameras are ready to use. Whoever shares first fills the next
              empty slot.
            </p>
            <RoomCamera
              active={tab === "photos"}
              layout={layout}
              images={images}
              targetSlot={selected?.index ?? null}
              disabled={disabled || !ready || (!selected && count === total)}
              onUse={share}
            />
          </div>
          <div className="room-capture-preview">
            <h2>Your shared photobooth</h2>
            <p className="editor-hint">
              See your photos come together. Tap a numbered photo above to
              change it.
            </p>
            <div className="preview-stage">
              {tab === "photos" && (
                <PhotostripPreview
                  layout={layout}
                  images={images}
                  design={previewDesign}
                  selected={null}
                  onSelect={() => {}}
                  onUpdateSticker={() => {}}
                  onRemoveSticker={() => {}}
                  onBegin={() => {}}
                  onEnd={() => {}}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        id="room-design-panel"
        role="tabpanel"
        aria-labelledby="room-design-tab"
        hidden={tab !== "decorate"}
      >
        <RoomEditor
          layout={layout}
          images={images}
          room={room}
          client={client}
          busy={busy}
          live={live}
          onRoom={onRoom}
          canonicalSource={canonicalSource}
          persistChanges={persistChanges}
          resolveAsset={resolveAsset}
          active={tab === "decorate"}
          photosReady={ready}
          onPreview={setPreviewDesign}
          onRetake={async () => {
            if (single) {
              if (lastPhoto >= 0) choose(lastPhoto);
              else {
                setSelected(null);
                setTab("photos");
              }
            } else {
              const next = await roomRpc(client, "ramon_retake_photo", {
                room_code: room.code,
                expected_revision: room.revision,
              });
              onRoom(next);
              setTab("photos");
            }
          }}
          retakeCount={single ? 1 : 2}
        />
      </div>
    </section>
  );
}
