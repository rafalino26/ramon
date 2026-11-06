"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  FiChevronDown,
  FiChevronUp,
  FiCopy,
  FiRepeat,
  FiSearch,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import { stickerCatalog, type StickerAsset } from "@/lib/stickers";
import { MAX_STICKERS, type PlacedSticker } from "@/lib/editor-design";
import { prepareSticker } from "@/lib/sticker-upload";
import RangeField from "./RangeField";

interface Props {
  stickers: readonly PlacedSticker[];
  selected: PlacedSticker | undefined;
  onAdd: (asset: Pick<StickerAsset, "src" | "name">) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PlacedSticker>) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onLayer: (id: string, direction: number) => void;
  createSource: (blob: Blob) => string;
  onBegin: () => void;
  onEnd: () => void;
}
export default function StickerPanel({
  stickers,
  selected,
  onAdd,
  onSelect,
  onUpdate,
  onRemove,
  onDuplicate,
  onLayer,
  createSource,
  onBegin,
  onEnd,
}: Props) {
  const [category, setCategory] = useState("Nailong");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = useRef<AbortController | null>(null);
  useEffect(() => () => upload.current?.abort(), []);
  const full = stickers.length >= MAX_STICKERS;
  const visible = stickerCatalog.filter(
    (asset) =>
      (category === "All" || category === asset.category) &&
      asset.name.toLowerCase().includes(search.toLowerCase()),
  );
  const fileChanged = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || full) return;
    upload.current?.abort();
    const controller = new AbortController();
    upload.current = controller;
    setBusy(true);
    setError(null);
    try {
      const blob = await prepareSticker(file, controller.signal);
      if (!controller.signal.aborted)
        onAdd({
          src: createSource(blob),
          name: file.name.replace(/\.[^.]+$/, "").slice(0, 36) || "My sticker",
        });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "We couldn’t add this sticker.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <section>
      {selected && (
        <div
          className="selected-sticker-tools"
          aria-label="Selected sticker controls"
        >
          <div className="tool-section-title">
            <h3>{selected.name}</h3>
            <button
              type="button"
              className="small-icon-button"
              aria-label="Delete selected sticker"
              onClick={() => onRemove(selected.id)}
            >
              <FiTrash2 />
            </button>
          </div>
          <RangeField
            label="Sticker size"
            min={8}
            max={80}
            value={selected.size * 100}
            suffix="%"
            onChange={(value) => onUpdate(selected.id, { size: value / 100 })}
            onBegin={onBegin}
            onEnd={onEnd}
          />
          <RangeField
            label="Sticker rotation"
            min={-180}
            max={180}
            value={selected.rotation}
            suffix="°"
            onChange={(value) => onUpdate(selected.id, { rotation: value })}
            onBegin={onBegin}
            onEnd={onEnd}
          />
          <div className="range-pair">
            <RangeField
              label="Horizontal position"
              min={0}
              max={100}
              value={selected.x * 100}
              suffix="%"
              onChange={(value) => onUpdate(selected.id, { x: value / 100 })}
              onBegin={onBegin}
              onEnd={onEnd}
            />
            <RangeField
              label="Vertical position"
              min={0}
              max={100}
              value={selected.y * 100}
              suffix="%"
              onChange={(value) => onUpdate(selected.id, { y: value / 100 })}
              onBegin={onBegin}
              onEnd={onEnd}
            />
          </div>
          <div className="layer-actions">
            <button
              type="button"
              onClick={() =>
                onUpdate(selected.id, { flipped: !selected.flipped })
              }
            >
              <FiRepeat /> Flip
            </button>
            <button
              type="button"
              disabled={full}
              onClick={() => onDuplicate(selected.id)}
            >
              <FiCopy /> Duplicate
            </button>
            <button
              type="button"
              disabled={stickers[0]?.id === selected.id}
              onClick={() => onLayer(selected.id, -1)}
            >
              <FiChevronDown /> Back
            </button>
            <button
              type="button"
              disabled={stickers.at(-1)?.id === selected.id}
              onClick={() => onLayer(selected.id, 1)}
            >
              <FiChevronUp /> Front
            </button>
          </div>
          <p className="editor-hint">
            Arrow keys nudge a selected sticker. Shift moves it further; Delete
            removes it.
          </p>
        </div>
      )}
      <div className="tool-section-title">
        <h3>A little extra personality</h3>
        <span>
          {stickers.length}/{MAX_STICKERS}
        </span>
      </div>
      <div className="sticker-categories">
        {["All", "Nailong", "Stitch", "Cute"].map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <label className="sticker-search">
        <FiSearch />
        <input
          aria-label="Search stickers"
          placeholder="Find a little favourite…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="sticker-catalog" aria-label="Sticker collection">
        {visible.map((asset) => (
          <button
            type="button"
            key={asset.id}
            disabled={full}
            aria-label={`Add ${asset.name}`}
            title={asset.name}
            onClick={() => onAdd(asset)}
          >
            <img
              src={asset.src}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </button>
        ))}
        {!visible.length && (
          <p className="editor-hint">
            No little friends found. Try another name.
          </p>
        )}
      </div>
      <div className="sticker-upload-row">
        <button
          type="button"
          className="button button-secondary"
          disabled={busy || full}
          onClick={() => input.current?.click()}
        >
          <FiUpload /> {busy ? "Opening…" : "Upload sticker"}
        </button>
        <Link href="/sticker-credits" target="_blank" className="text-link">
          Sticker credits ↗
        </Link>
      </div>
      <input
        type="file"
        accept="image/png,image/webp,image/gif,image/jpeg"
        className="sr-only"
        tabIndex={-1}
        ref={input}
        onChange={fileChanged}
        aria-label="Upload custom sticker"
      />
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      <p className="editor-hint">
        Tap a sticker to add it. Drag it on your photo, or use the controls
        below. PNG and WebP keep transparent edges.
      </p>
      {stickers.length > 0 && (
        <div className="placed-stickers" aria-label="Your stickers">
          {stickers.map((sticker, index) => (
            <button
              key={sticker.id}
              type="button"
              aria-label={`Select ${sticker.name} ${index + 1}`}
              aria-pressed={selected?.id === sticker.id}
              onClick={() => onSelect(sticker.id)}
            >
              <img src={sticker.src} alt="" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
