import { canvasToBlob, coverCrop, loadImage } from "./images";
export { coverCrop } from "./images";
import type { PhotoSlots } from "./photobooth-session";
import type { EditorDesign } from "./editor-design";
import {
  effectsCss,
  getFilterOperations,
  applyFilterOperations,
} from "./photo-filters";
import { paintFrameArt } from "./frame-art";

export type ExportFormat = "png" | "jpeg";
export type ExportFiles = Record<ExportFormat, File>;
interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  ellipse?: boolean;
  background?: string;
}
export interface PreviewGeometry {
  width: number;
  height: number;
  radius: number;
  slots: Rectangle[];
  caption?: {
    text: string;
    x: number;
    baseline: number;
    width: number;
    font: string;
    color: string;
  };
}

export function getExportSize(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("The preview has no usable size.");
  }
  // Use the same conservative budget everywhere, including iPad desktop mode.
  const scale = Math.min(
    4096 / Math.max(width, height),
    Math.sqrt(4_000_000 / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

export function readPreviewGeometry(element: HTMLElement): PreviewGeometry {
  const box = element.getBoundingClientRect();
  const radiusText = getComputedStyle(element).borderTopLeftRadius;
  const radius = parseFloat(radiusText) || 0;
  const caption = element.querySelector<HTMLElement>("[data-caption]");
  const captionText = element.querySelector<HTMLElement>("[data-caption-text]");
  const baseline = element.querySelector<HTMLElement>(
    "[data-caption-baseline]",
  );
  const captionStyle = captionText ? getComputedStyle(captionText) : null;
  return {
    width: box.width,
    height: box.height,
    radius: radiusText.endsWith("%")
      ? (Math.min(box.width, box.height) * radius) / 100
      : radius,
    slots: Array.from(
      element.querySelectorAll<HTMLElement>("[data-photo-slot]"),
      (slot) => {
        const rect = slot.getBoundingClientRect();
        const style = getComputedStyle(slot);
        const rawRadius = style.borderTopLeftRadius;
        const slotRadius = parseFloat(rawRadius) || 0;
        return {
          x: rect.x - box.x,
          y: rect.y - box.y,
          width: rect.width,
          height: rect.height,
          radius: rawRadius.endsWith("%")
            ? (Math.min(rect.width, rect.height) * slotRadius) / 100
            : slotRadius,
          ellipse: rawRadius.endsWith("%") && slotRadius === 50,
          background: style.backgroundColor,
        };
      },
    ),
    ...(caption && captionText && baseline && captionStyle
      ? {
          caption: {
            text: captionText.textContent ?? "",
            x:
              caption.getBoundingClientRect().x -
              box.x +
              caption.getBoundingClientRect().width / 2,
            baseline: baseline.getBoundingClientRect().y - box.y,
            width: caption.getBoundingClientRect().width,
            font: `${captionStyle.fontWeight} ${captionStyle.fontSize} ${captionStyle.fontFamily}`,
            color: captionStyle.color,
          },
        }
      : {}),
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(r, 0);
  context.arcTo(width, 0, width, height, r);
  context.arcTo(width, height, 0, height, r);
  context.arcTo(0, height, 0, 0, r);
  context.arcTo(0, 0, width, 0, r);
  context.closePath();
}

function clipSlot(context: CanvasRenderingContext2D, rect: Rectangle) {
  if (!rect.radius) return;
  context.translate(rect.x, rect.y);
  if (rect.ellipse) {
    context.beginPath();
    context.ellipse(
      rect.width / 2,
      rect.height / 2,
      rect.width / 2,
      rect.height / 2,
      0,
      0,
      Math.PI * 2,
    );
  } else {
    roundedRect(context, rect.width, rect.height, rect.radius);
  }
  context.clip();
  context.translate(-rect.x, -rect.y);
}

/** Draw the measured preview rather than maintaining a second, different layout. */
export async function prepareExport(
  geometry: PreviewGeometry,
  images: PhotoSlots,
  color: string,
  signal: AbortSignal,
  design?: EditorDesign,
): Promise<ExportFiles> {
  if (!images.some(Boolean) || geometry.slots.length !== images.length) {
    throw new Error("The photos and preview are out of sync.");
  }
  const size = getExportSize(geometry.width, geometry.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.scale(size.width / geometry.width, size.height / geometry.height);
    context.save();
    roundedRect(context, geometry.width, geometry.height, geometry.radius);
    context.clip();
    context.fillStyle = color;
    context.fillRect(0, 0, geometry.width, geometry.height);

    if (design)
      paintFrameArt(
        context,
        geometry.width,
        geometry.height,
        design.pattern,
        design.frame,
        design.patternColor,
      );

    // Decode sequentially so six large phone photos are never held in memory together.
    for (let index = 0; index < images.length; index++) {
      signal.throwIfAborted();
      const rect = geometry.slots[index];
      if (rect.width <= 0 || rect.height <= 0)
        throw new Error("A photo slot has no usable size.");
      const source = images[index];
      if (!source) {
        context.save();
        clipSlot(context, rect);
        context.fillStyle = rect.background ?? "#eee7f5";
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.restore();
        continue;
      }
      const image = await loadImage(source, signal);
      try {
        const crop = coverCrop(
          image.naturalWidth,
          image.naturalHeight,
          rect.width,
          rect.height,
        );
        context.save();
        clipSlot(context, rect);
        const operations = design ? getFilterOperations(design.effects) : [];
        const nativeFilter = typeof Reflect.get(context, "filter") === "string";
        if (design && nativeFilter) context.filter = effectsCss(design.effects);
        if (operations.length && !nativeFilter) {
          const work = document.createElement("canvas");
          work.width = Math.max(
            1,
            Math.ceil((rect.width * size.width) / geometry.width),
          );
          work.height = Math.max(
            1,
            Math.ceil((rect.height * size.height) / geometry.height),
          );
          try {
            const workContext = work.getContext("2d");
            if (!workContext)
              throw new Error("Unable to apply this photo filter.");
            workContext.drawImage(
              image,
              crop.sx,
              crop.sy,
              crop.sw,
              crop.sh,
              0,
              0,
              work.width,
              work.height,
            );
            const pixels = workContext.getImageData(
              0,
              0,
              work.width,
              work.height,
            );
            applyFilterOperations(pixels.data, operations);
            workContext.putImageData(pixels, 0, 0);
            context.drawImage(work, rect.x, rect.y, rect.width, rect.height);
          } finally {
            work.width = work.height = 0;
          }
        } else
          context.drawImage(
            image,
            crop.sx,
            crop.sy,
            crop.sw,
            crop.sh,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
          );
        context.restore();
      } finally {
        image.src = "";
      }
    }
    if (geometry.caption) {
      const caption = geometry.caption;
      context.font = caption.font;
      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.fillStyle = caption.color;
      context.fillText(
        caption.text,
        caption.x,
        caption.baseline,
        caption.width,
      );
    }
    for (const sticker of design?.stickers ?? []) {
      signal.throwIfAborted();
      const image = await loadImage(sticker.src, signal);
      try {
        const boxSize = geometry.width * sticker.size;
        const scale = Math.min(
          boxSize / image.naturalWidth,
          boxSize / image.naturalHeight,
        );
        const width = image.naturalWidth * scale,
          height = image.naturalHeight * scale;
        context.save();
        context.translate(
          geometry.width * sticker.x,
          geometry.height * sticker.y,
        );
        context.rotate((sticker.rotation * Math.PI) / 180);
        if (sticker.flipped) context.scale(-1, 1);
        context.drawImage(image, -width / 2, -height / 2, width, height);
        context.restore();
      } finally {
        image.src = "";
      }
    }
    context.restore();
    signal.throwIfAborted();
    const png = await canvasToBlob(canvas, "image/png");
    signal.throwIfAborted();
    // JPEG has no alpha. Fill behind the clipped frame to avoid black corners.
    context.save();
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, geometry.width, geometry.height);
    context.restore();
    const jpeg = await canvasToBlob(canvas, "image/jpeg");
    signal.throwIfAborted();
    return {
      png: new File([png], "ramon-photobooth.png", { type: "image/png" }),
      jpeg: new File([jpeg], "ramon-photobooth.jpg", { type: "image/jpeg" }),
    };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
