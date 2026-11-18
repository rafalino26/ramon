"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";
import {
  FiArrowRight,
  FiCheck,
  FiDownload,
  FiGrid,
  FiDroplet,
  FiSmile,
  FiSliders,
  FiType,
  FiRotateCcw,
  FiRotateCw,
  FiRefreshCw,
  FiTrash2,
  FiCopy,
  FiMinus,
  FiPlus,
  FiRepeat,
} from "react-icons/fi";
import type {
  PhotoboothSession,
  SessionAction,
} from "@/lib/photobooth-session";
import {
  createDesign,
  normalizeSticker,
  addSticker,
  MAX_STICKERS,
  type EditorDesign,
  type PlacedSticker,
} from "@/lib/editor-design";
import type { StickerAsset } from "@/lib/stickers";
import { usePreparedExport } from "@/hooks/use-prepared-export";
import type { DownloadFormat } from "@/lib/extra-exports";
import PhotostripPreview from "./photostrip";
import { Flower } from "./MemoryArt";
import StickerPanel from "./editor/StickerPanel";
import PhotoEditor from "./editor/PhotoEditor";
import { effectsCss } from "@/lib/photo-filters";
import { FiEye } from "react-icons/fi";
import {
  FramePanel,
  ColorPanel,
  FilterPanel,
  TextPanel,
} from "./editor/StylePanels";

interface Props {
  session: PhotoboothSession;
  dispatch: Dispatch<SessionAction>;
  createStickerSource: (blob: Blob) => string;
  onChooseLayout: () => void;
  readOnly?: boolean;
  history?: { canUndo: boolean; canRedo: boolean };
  assetsReady?: boolean;
  active?: boolean;
  onApplyPhoto?: (index: number, source: string, blob: Blob) => Promise<void>;
  photoHistory?: { canUndo: boolean; canRedo: boolean; undo: () => Promise<void>; redo: () => Promise<void> };
}
const tabs = [
  { id: "frame", label: "Frame", icon: FiGrid },
  { id: "color", label: "Color", icon: FiDroplet },
  { id: "filters", label: "Filters", icon: FiSliders },
  { id: "stickers", label: "Stickers", icon: FiSmile },
  { id: "text", label: "Text", icon: FiType },
] as const;
type Panel = (typeof tabs)[number]["id"];

export default function Edit({
  session,
  dispatch,
  createStickerSource,
  onChooseLayout,
  readOnly = false,
  history,
  assetsReady = true,
  active = true,
  onApplyPhoto,
  photoHistory,
}: Props) {
  const { layout, images, design } = session;
  const [panel, setPanel] = useState<Panel>("frame");
  const [selected, setSelected] = useState<string | null>(null);
  const [filename, setFilename] = useState("ramon-photobooth");
  const [copied, setCopied] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  const previewColumn = useRef<HTMLDivElement>(null);
  const saveSection = useRef<HTMLElement>(null);
  const [photoTarget, setPhotoTarget] = useState<{ index: number; source: string; aspect: number } | null>(null);
  const [lastEdit, setLastEdit] = useState<"design" | "photo">("design");
  const [photoError, setPhotoError] = useState("");
  const {
    ready: exportReady,
    isSaving,
    error,
    download: saveDownload,
    copy,
    retry,
    pdfReady,
    webpReady,
    webpAvailable,
    pdfError,
    retryPdf,
  } = usePreparedExport(preview, images, design, active);
  const ready = assetsReady && exportReady;
  const download = (format: DownloadFormat) => saveDownload(format, filename);
  useEffect(() => {
    setCopied(false);
  }, [images, design]);
  const change = (patch: Partial<EditorDesign>) => {
    setLastEdit("design");
    dispatch({ type: "design", patch });
  };
  const begin = () => { setLastEdit("design"); dispatch({ type: "design-begin" }); };
  const end = () => dispatch({ type: "design-end" });
  const undoEdit = useCallback((redo = false) => {
    if (lastEdit === "photo" && photoHistory) {
      void (redo ? photoHistory.redo() : photoHistory.undo()).catch(cause => setPhotoError(cause.message));
    } else dispatch({ type: redo ? "redo" : "undo" });
  }, [lastEdit, photoHistory, dispatch]);
  useEffect(() => {
    if (selected && !design.stickers.some((sticker) => sticker.id === selected))
      setSelected(null);
  }, [design.stickers, selected]);
  useEffect(() => {
    if (selected)
      preview.current
        ?.querySelector<HTMLElement>(`[data-sticker-id="${selected}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (readOnly || !active || photoTarget) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.matches(
            "textarea,input:not([type=range]):not([type=color]),select",
          ))
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoEdit(event.shiftKey);
      }
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [undoEdit, readOnly, active, photoTarget]);
  const updateSticker = (id: string, patch: Partial<PlacedSticker>) =>
    change({
      stickers: design.stickers.map((sticker) =>
        sticker.id === id
          ? normalizeSticker({ ...sticker, ...patch })
          : sticker,
      ),
    });
  const removeSticker = (id: string) => {
    change({
      stickers: design.stickers.filter((sticker) => sticker.id !== id),
    });
    if (selected === id) setSelected(null);
  };
  const placeSticker = (asset: Pick<StickerAsset, "src" | "name">) => {
    if (design.stickers.length >= MAX_STICKERS) return;
    const sticker: PlacedSticker = {
      id: crypto.randomUUID(),
      src: asset.src,
      name: asset.name,
      x: 0.5 + ((design.stickers.length % 3) - 1) * 0.08,
      y: 0.65,
      size: 0.32,
      rotation: 0,
      flipped: false,
    };
    change({ stickers: addSticker(design, sticker) });
    setSelected(sticker.id);
  };
  const duplicateSticker = (id: string) => {
    const original = design.stickers.find((sticker) => sticker.id === id);
    if (!original || design.stickers.length >= MAX_STICKERS) return;
    const sticker = normalizeSticker({
      ...original,
      id: crypto.randomUUID(),
      x: original.x + 0.06,
      y: original.y + 0.04,
    });
    change({ stickers: addSticker(design, sticker) });
    setSelected(sticker.id);
  };
  const layerSticker = (id: string, direction: number) => {
    const index = design.stickers.findIndex((sticker) => sticker.id === id),
      target = index + direction;
    if (index < 0 || target < 0 || target >= design.stickers.length) return;
    const stickers = [...design.stickers];
    [stickers[index], stickers[target]] = [stickers[target], stickers[index]];
    change({ stickers });
  };
  const common = { design, onChange: change, onBegin: begin, onEnd: end };
  const activeSticker = design.stickers.find(
    (sticker) => sticker.id === selected,
  );

  if (!images.some(Boolean))
    return (
      <div className="empty-editor">
        <Flower />
        <h2>No photos just yet.</h2>
        <p>
          A few favourite photos are all you need. Take some with your camera or
          bring your own.
        </p>
        <button
          type="button"
          onClick={onChooseLayout}
          className="button button-primary"
        >
          Let&apos;s get started <FiArrowRight />
        </button>
      </div>
    );
  return (
    <div className="editor-workspace">
      <div className="editor-preview-column" ref={previewColumn}>
        <div className="summary-label">
          <span>Your little masterpiece</span>
          <span className="small-badge">{layout.label}</span>
        </div>
        <fieldset disabled={readOnly} className="room-control-group">
          <div className="preview-toolbar">
            <div>
              <button
                type="button"
                className="small-icon-button"
                aria-label={!history && session.past.at(-1)?.photoEdit ? "Undo photo edit" : "Undo design change"}
                title="Undo (Ctrl / Cmd Z)"
                disabled={history ? !history.canUndo : !session.past.length}
                onClick={() => dispatch({ type: "undo" })}
              >
                <FiRotateCcw />
              </button>
              <button
                type="button"
                className="small-icon-button"
                aria-label={!history && session.future[0]?.photoEdit ? "Redo photo edit" : "Redo design change"}
                title="Redo (Shift Ctrl / Cmd Z)"
                disabled={history ? !history.canRedo : !session.future.length}
                onClick={() => dispatch({ type: "redo" })}
              >
                <FiRotateCw />
              </button>
            </div>
            <div>
              <button
                type="button"
                className="small-icon-button"
                aria-label="Reset design"
                title="Reset styling; keep photos"
                onClick={() => change(createDesign())}
              >
                <FiRefreshCw />
              </button>
            </div>
          </div>
          {activeSticker && (
            <div
              className="sticker-quick-tools"
              role="group"
              aria-label="Sticker quick actions"
            >
              <span>Selected sticker</span>
              <div>
                <button
                  type="button"
                  aria-label="Decrease sticker size"
                  title="Smaller"
                  onClick={() =>
                    updateSticker(activeSticker.id, {
                      size: activeSticker.size - 0.04,
                    })
                  }
                >
                  <FiMinus />
                </button>
                <button
                  type="button"
                  aria-label="Increase sticker size"
                  title="Bigger"
                  onClick={() =>
                    updateSticker(activeSticker.id, {
                      size: activeSticker.size + 0.04,
                    })
                  }
                >
                  <FiPlus />
                </button>
                <button
                  type="button"
                  aria-label="Rotate sticker left"
                  title="Rotate left 15 degrees"
                  onClick={() =>
                    updateSticker(activeSticker.id, {
                      rotation:
                        ((activeSticker.rotation + 345 + 180) % 360) - 180,
                    })
                  }
                >
                  <FiRotateCcw />
                </button>
                <button
                  type="button"
                  aria-label="Rotate sticker right"
                  title="Rotate right 15 degrees"
                  onClick={() =>
                    updateSticker(activeSticker.id, {
                      rotation:
                        ((activeSticker.rotation + 15 + 180) % 360) - 180,
                    })
                  }
                >
                  <FiRotateCw />
                </button>
                <button
                  type="button"
                  aria-label="Flip selected sticker"
                  title="Flip"
                  onClick={() =>
                    updateSticker(activeSticker.id, {
                      flipped: !activeSticker.flipped,
                    })
                  }
                >
                  <FiRepeat />
                </button>
                <button
                  type="button"
                  aria-label="Duplicate selected sticker"
                  title="Duplicate"
                  disabled={design.stickers.length >= MAX_STICKERS}
                  onClick={() => duplicateSticker(activeSticker.id)}
                >
                  <FiCopy />
                </button>
                <button
                  type="button"
                  aria-label="Remove sticker from preview"
                  title="Delete"
                  onClick={() => removeSticker(activeSticker.id)}
                >
                  <FiTrash2 />
                </button>
              </div>
              <small>Drag the corner to resize · drag ↻ to rotate</small>
            </div>
          )}
        </fieldset>
        {onApplyPhoto && <p className="photo-adjust-hint">Tap a photo to adjust its crop, zoom or rotation.</p>}
        {photoError && <p className="notice-error" role="alert">{photoError}</p>}
        <div className="preview-stage">
          <PhotostripPreview
            ref={preview}
            layout={layout}
            images={images}
            design={design}
            selected={selected}
            onSelect={setSelected}
            onUpdateSticker={updateSticker}
            onRemoveSticker={removeSticker}
            onBegin={begin}
            onEnd={end}
            onEditPhoto={onApplyPhoto && !readOnly && active && assetsReady ? (index, aspect) => {
              const source = images[index];
              if (!source) return;
              setSelected(null);
              setPhotoTarget({ index, source, aspect });
            } : undefined}
          />
          <span className="preview-caption">
            {design.stickers.length
              ? "drag a little friend to its happy place"
              : "a moment worth keeping"}
          </span>
        </div>
      </div>
      <div className="editor-tools">
        <fieldset disabled={readOnly} className="room-control-group">
          <div className="panel-heading">
            <span className="panel-kicker">THE FINISHING TOUCHES</span>
            <h2>A little more you.</h2>
            <p>Frames, colours, little friends. Make it your kind of lovely.</p>
          </div>
          <div className="editor-tabs" aria-label="Photo styling">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={panel === id}
                onClick={() => setPanel(id)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>
          {panel === "frame" && <FramePanel {...common} layout={layout} />}
          {panel === "color" && <ColorPanel {...common} />}
          {panel === "filters" && <FilterPanel {...common} />}
          {panel === "text" && <TextPanel {...common} />}
          {panel === "stickers" && (
            <StickerPanel
              stickers={design.stickers}
              selected={design.stickers.find(
                (sticker) => sticker.id === selected,
              )}
              onAdd={placeSticker}
              onSelect={setSelected}
              onUpdate={updateSticker}
              onRemove={removeSticker}
              onDuplicate={duplicateSticker}
              onLayer={layerSticker}
              createSource={createStickerSource}
              onBegin={begin}
              onEnd={end}
            />
          )}
        </fieldset>
        <section className="save-section" ref={saveSection}>
          <div className="save-heading">
            <h3>Keep this little moment.</h3>
            <span
              role="status"
              className={`export-status ${ready ? "is-ready" : ""}`}
            >
              {isSaving ? (
                "Saving..."
              ) : ready ? (
                <>
                  <FiCheck /> Ready to save
                </>
              ) : error ? (
                "Needs another try"
              ) : (
                "Preparing..."
              )}
            </span>
          </div>
          {error && (
            <div className="notice-error" role="alert">
              {error}
              <button type="button" onClick={retry}>
                Try again
              </button>
            </div>
          )}
          <label className="export-filename">
            File name
            <input aria-label="File name" value={filename} maxLength={100}
              placeholder="ramon-photobooth" onChange={event => setFilename(event.target.value)} />
          </label>
          <button type="button" className="button button-secondary copy-image-button"
            disabled={!ready || isSaving} onClick={async () => setCopied(await copy())}>
            <FiCopy /> Copy image
          </button>
          {copied && <p role="status">Image copied. Paste it into your chat or document.</p>}
          <div className="download-actions">
            <button
              type="button"
              className="button button-secondary"
              disabled={!ready || isSaving}
              onClick={() => download("png")}
            >
              <FiDownload /> PNG
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!ready || isSaving}
              onClick={() => download("jpeg")}
            >
              <FiDownload /> JPG
            </button>
            <button
              type="button"
              className="button button-secondary"
              disabled={!ready || !pdfReady || isSaving}
              aria-busy={ready && !pdfReady && !pdfError}
              onClick={() => download("pdf")}
            >
              <FiDownload /> PDF
            </button>
            {webpAvailable && (
              <button
                type="button"
                className="button button-secondary"
                disabled={!ready || !webpReady || isSaving}
                onClick={() => download("webp")}
              >
                <FiDownload /> WebP
              </button>
            )}
          </div>
          {pdfError && (
            <div className="notice-error" role="alert">
              {pdfError}
              <button type="button" onClick={retryPdf}>
                Retry PDF
              </button>
            </div>
          )}
          {ready && !pdfReady && !pdfError && (
            <p role="status">Preparing PDF…</p>
          )}
          <p>
            PDF fits your design on one A4 page. Orientation follows your
            layout.
          </p>
          <p>
            Stickers, filters and captions are included. Save before you leave.
          </p>
        </section>
      </div>
      {photoTarget && onApplyPhoto && active && (
        <PhotoEditor key={`${photoTarget.index}:${photoTarget.source}`} {...photoTarget}
          filter={effectsCss(design.effects)} stale={images[photoTarget.index] !== photoTarget.source}
          onClose={() => setPhotoTarget(null)}
          onApply={async blob => {
            await onApplyPhoto(photoTarget.index, photoTarget.source, blob);
            setLastEdit("photo");
          }} />
      )}
      {active && <nav className="mobile-editor-toolbar" aria-label="Mobile editor actions">
        <button type="button" disabled={readOnly || (lastEdit === "photo" && photoHistory ? !photoHistory.canUndo : history ? !history.canUndo : !session.past.length)}
          aria-label={lastEdit === "photo" && photoHistory ? "Undo photo edit" : "Undo last edit"}
          onClick={() => undoEdit()}><FiRotateCcw /><span>Undo</span></button>
        <button type="button" disabled={readOnly || (lastEdit === "photo" && photoHistory ? !photoHistory.canRedo : history ? !history.canRedo : !session.future.length)}
          aria-label={lastEdit === "photo" && photoHistory ? "Redo photo edit" : "Redo last edit"}
          onClick={() => undoEdit(true)}><FiRotateCw /><span>Redo</span></button>
        <button type="button" onClick={() => previewColumn.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><FiEye /><span>View result</span></button>
        <button type="button" onClick={() => saveSection.current?.scrollIntoView({ behavior: "smooth", block: "start" })}><FiDownload /><span>Download options</span></button>
      </nav>}
    </div>
  );
}
