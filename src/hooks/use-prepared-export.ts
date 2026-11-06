"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  prepareExport,
  readPreviewGeometry,
  type ExportFiles,
  type ExportFormat,
} from "@/lib/export";
import { saveFile } from "@/lib/download";
import type { PhotoSlots } from "@/lib/photobooth-session";
import type { EditorDesign } from "@/lib/editor-design";

export function usePreparedExport(
  preview: RefObject<HTMLDivElement | null>,
  images: PhotoSlots,
  design: EditorDesign,
) {
  const [prepared, setPrepared] = useState<{
    files: ExportFiles;
    images: PhotoSlots;
    design: EditorDesign;
    revision: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const element = preview.current;
    if (!element) return;
    let previousSize = "";
    const observer = new ResizeObserver(() => {
      const box = element.getBoundingClientRect();
      const size = `${box.width}:${box.height}`;
      if (size !== previousSize) {
        previousSize = size;
        setRevision((value) => value + 1);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [preview, images]);

  useEffect(() => {
    const element = preview.current;
    if (!element || !images.some(Boolean)) return;
    const controller = new AbortController();
    setError(null);
    setPrepared(null);
    // Coalesce rapid color/resize changes; all encoding happens before Save is clicked.
    const timer = window.setTimeout(async () => {
      try {
        if (design.caption.text) await document.fonts.ready;
        controller.signal.throwIfAborted();
        const files = await prepareExport(
          readPreviewGeometry(element),
          images,
          design.borderColor,
          controller.signal,
          design,
        );
        if (!controller.signal.aborted)
          setPrepared({ files, images, design, revision });
      } catch (cause) {
        if (!controller.signal.aborted) {
          const message =
            cause instanceof Error
              ? cause.message
              : "Unable to prepare the photo.";
          setError(message);
        }
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [preview, images, design, revision]);

  // Identity checks prevent downloading the previous frame during an effect transition.
  const ready =
    prepared !== null &&
    prepared.images === images &&
    prepared.design === design &&
    prepared.revision === revision;

  const download = async (format: ExportFormat) => {
    if (!ready || saving.current) return;
    saving.current = true;
    setIsSaving(true);
    try {
      await saveFile(prepared.files[format]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save the photo. Please try again.",
      );
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };
  return {
    ready,
    isSaving,
    error,
    download,
    retry: () => setRevision((value) => value + 1),
  };
}
