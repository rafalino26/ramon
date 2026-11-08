import { canvasToBlob, loadImage } from "./images";
import type { ExportFormat } from "./export";

export type DownloadFormat = ExportFormat | "pdf" | "webp";

/** Place the complete artwork on A4 without changing its aspect ratio. */
export function getPdfPlacement(imageWidth: number, imageHeight: number) {
  if (
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight) ||
    imageWidth <= 0 ||
    imageHeight <= 0
  )
    throw new Error("The photo has no usable size.");
  const [pageWidth, pageHeight] =
    imageWidth > imageHeight ? [841.89, 595.28] : [595.28, 841.89];
  const margin = 24;
  const scale = Math.min(
    (pageWidth - margin * 2) / imageWidth,
    (pageHeight - margin * 2) / imageHeight,
  );
  const width = imageWidth * scale,
    height = imageHeight * scale;
  return {
    pageWidth,
    pageHeight,
    width,
    height,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
  };
}

export async function preparePdfFile(
  jpeg: File,
  signal: AbortSignal,
): Promise<File> {
  signal.throwIfAborted();
  const { PDFDocument } = await import("pdf-lib");
  signal.throwIfAborted();
  const document = await PDFDocument.create();
  const image = await document.embedJpg(await jpeg.arrayBuffer());
  signal.throwIfAborted();
  const placement = getPdfPlacement(image.width, image.height);
  const page = document.addPage([placement.pageWidth, placement.pageHeight]);
  page.drawImage(image, {
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
  });
  document.setTitle("Ramon Photobooth");
  document.setCreator("Ramon Photobooth");
  const bytes = await document.save();
  signal.throwIfAborted();
  return new File([new Uint8Array(bytes)], "ramon-photobooth.pdf", {
    type: "application/pdf",
  });
}

/** Re-encode the already rendered PNG, preserving its transparent corners. */
export async function prepareWebpFile(
  png: File,
  signal: AbortSignal,
): Promise<File | null> {
  signal.throwIfAborted();
  const source = URL.createObjectURL(png);
  const canvas = document.createElement("canvas");
  let image: HTMLImageElement | undefined;
  try {
    image = await loadImage(source, signal);
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(image, 0, 0);
    const blob = await canvasToBlob(canvas, "image/webp", 0.92);
    signal.throwIfAborted();
    // Some browsers silently return PNG for unsupported encoders.
    if (blob.type !== "image/webp") return null;
    return new File([blob], "ramon-photobooth.webp", { type: "image/webp" });
  } finally {
    if (image) image.src = "";
    canvas.width = canvas.height = 0;
    URL.revokeObjectURL(source);
  }
}
