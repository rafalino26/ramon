"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { FiRotateCcw, FiRotateCw, FiX } from "react-icons/fi";
import { cropGeometry, cropPhoto, initialPhotoCrop, paintPhotoCrop } from "@/lib/photo-crop";
import { loadImage } from "@/lib/images";

interface Props {
  index: number;
  source: string;
  aspect: number;
  filter: string;
  stale: boolean;
  onApply: (blob: Blob) => Promise<void>;
  onClose: () => void;
}

export default function PhotoEditor({ index, source, aspect, filter, stale, onApply, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const loaded = useRef<HTMLImageElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [crop, setCrop] = useState(initialPhotoCrop);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const node = dialog.current!;
    node.showModal();
    const abort = new AbortController();
    let image: HTMLImageElement | null = null;
    loadImage(source, abort.signal).then(value => {
      if (abort.signal.aborted) { value.src = ""; return; }
      image = value;
      loaded.current = value;
      setReady(true);
    }).catch(cause => {
      if (!abort.signal.aborted) setError(cause.message);
    });
    return () => {
      abort.abort();
      controller.current?.abort();
      if (image) image.src = "";
      loaded.current = null;
      node.close();
    };
  }, [source]);

  useEffect(() => {
    if (!ready || !loaded.current || !canvas.current) return;
    const node = canvas.current;
    const scale = Math.min(1, aspect);
    node.width = Math.round(600 * scale);
    node.height = Math.round(node.width / aspect);
    try { paintPhotoCrop(node, loaded.current, aspect, crop); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to preview this photo."); }
  }, [ready, aspect, crop]);

  const apply = async () => {
    if (saving || stale || !ready) return;
    const abort = new AbortController();
    controller.current = abort;
    setSaving(true);
    setError("");
    try {
      const blob = await cropPhoto(source, aspect, crop, abort.signal);
      await onApply(blob);
      if (!abort.signal.aborted) onClose();
    } catch (cause) {
      if (!abort.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "The photo could not be updated.");
        setSaving(false);
      }
    }
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const start = drag.current;
    const image = loaded.current;
    if (!start || !image) return;
    const box = event.currentTarget.getBoundingClientRect();
    const geometry = cropGeometry(image.naturalWidth, image.naturalHeight, aspect, crop);
    const panX = start.panX - (event.clientX - start.x) / box.width * geometry.sw / Math.max(1, geometry.rotatedWidth - geometry.sw) * 2;
    const panY = start.panY - (event.clientY - start.y) / box.height * geometry.sh / Math.max(1, geometry.rotatedHeight - geometry.sh) * 2;
    setCrop(previous => ({ ...previous, panX: Math.max(-1, Math.min(1, panX)), panY: Math.max(-1, Math.min(1, panY)) }));
  };

  return (
    <dialog ref={dialog} className="photo-edit-dialog" aria-labelledby="photo-edit-heading"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
      <div className="photo-edit-heading">
        <h2 id="photo-edit-heading">Adjust photo {index + 1}</h2>
        <button type="button" className="small-icon-button" aria-label="Close photo editor" disabled={saving} onClick={onClose}><FiX /></button>
      </div>
      <p>Drag the photo to find your favourite framing.</p>
      <div className="photo-edit-canvas-wrap">
        <canvas ref={canvas} aria-label="Photo crop preview" style={{ aspectRatio: aspect, filter }}
          onPointerDown={event => {
            if (!ready || saving) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, panX: crop.panX, panY: crop.panY };
          }}
          onPointerMove={move}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onLostPointerCapture={() => { drag.current = null; }} />
      </div>
      <fieldset disabled={saving || !ready} className="photo-edit-controls">
        <label>Zoom <output>{crop.zoom.toFixed(2)}×</output>
          <input aria-label="Photo zoom" type="range" min={1} max={3} step={0.05} value={crop.zoom} onChange={event => setCrop(previous => ({ ...previous, zoom: Number(event.target.value) }))} />
        </label>
        {(["panX", "panY"] as const).map(axis => (
          <label key={axis}>{axis === "panX" ? "Horizontal position" : "Vertical position"}
            <input aria-label={axis === "panX" ? "Photo horizontal position" : "Photo vertical position"} type="range" min={-1} max={1} step={0.01} value={crop[axis]} onChange={event => setCrop(previous => ({ ...previous, [axis]: Number(event.target.value) }))} />
          </label>
        ))}
        <div className="photo-edit-actions">
          <button type="button" className="button button-secondary" aria-label="Rotate photo left" onClick={() => setCrop(previous => ({ ...previous, rotation: previous.rotation - 90, panX: 0, panY: 0 }))}><FiRotateCcw /> 90°</button>
          <button type="button" className="button button-secondary" aria-label="Rotate photo right" onClick={() => setCrop(previous => ({ ...previous, rotation: previous.rotation + 90, panX: 0, panY: 0 }))}><FiRotateCw /> 90°</button>
          <button type="button" className="button button-secondary" onClick={() => setCrop(initialPhotoCrop)}>Reset crop</button>
        </div>
      </fieldset>
      {stale && <p role="alert" className="notice-error">This photo changed while you were editing. Close this panel and select the updated photo.</p>}
      {error && <p role="alert" className="notice-error">{error}</p>}
      <div className="photo-edit-actions">
        <button type="button" className="button button-secondary" disabled={saving} onClick={onClose}>Cancel</button>
        <button type="button" className="button button-primary" disabled={!ready || saving || stale} onClick={() => void apply()}>{saving ? "Applying…" : "Apply photo edit"}</button>
      </div>
    </dialog>
  );
}
