import { canvasToBlob, loadImage } from "./images";

/** Preserve sticker transparency, unlike the JPEG photo-upload path. */
export async function prepareSticker(
  file: File,
  signal: AbortSignal,
): Promise<Blob> {
  if (!/^image\/(png|webp|gif|jpeg)$/.test(file.type))
    throw new Error("Choose a PNG, WebP, GIF or JPG sticker.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Choose a sticker smaller than 15 MB.");
  const url = URL.createObjectURL(file);
  const canvas = document.createElement("canvas");
  try {
    const image = await loadImage(url, signal);
    try {
      const scale = Math.min(
        1,
        512 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Your browser could not open this sticker.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await canvasToBlob(canvas, "image/png");
    } finally {
      image.src = "";
    }
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
  }
}
