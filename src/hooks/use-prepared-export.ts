"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  prepareExport,
  readPreviewGeometry,
  type ExportFiles,
} from "@/lib/export";
import {
  preparePdfFile,
  prepareWebpFile,
  type DownloadFormat,
} from "@/lib/extra-exports";
import { saveFile } from "@/lib/download";
import type { PhotoSlots } from "@/lib/photobooth-session";
import type { EditorDesign } from "@/lib/editor-design";

export function usePreparedExport(
  preview: RefObject<HTMLDivElement | null>,
  images: PhotoSlots,
  design: EditorDesign,
  enabled = true,
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
  const [extraRevision, setExtraRevision] = useState(0);
  const [webpAvailable, setWebpAvailable] = useState(false);
  const [extra, setExtra] = useState<{
    source: ExportFiles;
    pdf?: File;
    webp?: File;
    pdfError?: string;
  } | null>(null);

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
    if (!enabled || !element || !images.some(Boolean)) return;
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
  }, [preview, images, design, revision, enabled]);

  useEffect(() => {
    if (!prepared || !enabled) {
      setExtra(null);
      return;
    }
    const controller = new AbortController();
    const source = prepared.files;
    setExtra({ source });
    // Additional formats prepare independently, so PNG/JPG can be saved first.
    void preparePdfFile(source.jpeg, controller.signal)
      .then((pdf) => {
        if (!controller.signal.aborted)
          setExtra((previous) =>
            previous?.source === source ? { ...previous, pdf } : previous,
          );
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setExtra((previous) =>
            previous?.source === source
              ? {
                  ...previous,
                  pdfError:
                    cause instanceof Error
                      ? cause.message
                      : "PDF could not be prepared.",
                }
              : previous,
          );
      });
    void prepareWebpFile(source.png, controller.signal)
      .then((webp) => {
        if (webp && !controller.signal.aborted) {
          setWebpAvailable(true);
          setExtra((previous) =>
            previous?.source === source ? { ...previous, webp } : previous,
          );
        }
      })
      .catch(() => {
        /* Optional encoders may be unavailable in this browser. */
      });
    return () => controller.abort();
  }, [prepared, enabled, extraRevision]);

  // Identity checks prevent downloading the previous frame during an effect transition.
  const ready =
    enabled &&
    prepared !== null &&
    prepared.images === images &&
    prepared.design === design &&
    prepared.revision === revision;

  const currentExtra = extra?.source === prepared?.files ? extra : null;
  const download = async (format: DownloadFormat) => {
    if (!ready || saving.current) return;
    const file =
      format === "png" || format === "jpeg"
        ? prepared.files[format]
        : currentExtra?.[format];
    if (!file) return;
    saving.current = true;
    setIsSaving(true);
    try {
      await saveFile(file);
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
    pdfReady: ready && !!currentExtra?.pdf,
    webpReady: ready && !!currentExtra?.webp,
    webpAvailable,
    pdfError: ready ? currentExtra?.pdfError : undefined,
    retryPdf: () => setExtraRevision((value) => value + 1),
    retry: () => setRevision((value) => value + 1),
  };
}
