const MAX_PHOTO_EDGE = 1920;

export function coverCrop(
  imageWidth: number,
  imageHeight: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const sw = width / scale;
  const sh = height / scale;
  return { sx: (imageWidth - sw) / 2, sy: (imageHeight - sh) / 2, sw, sh };
}

export function loadImage(
  source: string,
  signal?: AbortSignal,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(
      () => finish(new Error("Image loading timed out.")),
      15_000,
    );
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", onAbort);
      if (error) {
        image.src = "";
        reject(error);
      } else {
        resolve(image);
      }
    };
    const onAbort = () =>
      finish(new DOMException("Image loading canceled", "AbortError"));
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight)
        finish(new Error("The image has no usable pixels."));
      else finish();
    };
    image.onerror = () => finish(new Error("The image could not be loaded."));
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    image.decoding = "async";
    // Attach handlers before src: cached/blob images can load immediately in Safari.
    image.src = source;
  });
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Unable to encode the image.")),
      type,
      type === "image/jpeg" ? 0.92 : undefined,
    );
  });
}

export function fitPhotoSize(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("Invalid image dimensions.");
  }
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function isHeic(file: Pick<File, "type" | "name">) {
  return (
    /image\/hei[cf](?:-sequence)?$/i.test(file.type) ||
    /\.hei[cf]$/i.test(file.name)
  );
}

/** Normalize large phone images once, instead of decoding originals on every export. */
export async function prepareUpload(
  file: File,
  signal: AbortSignal,
): Promise<Blob> {
  if (
    !file.type.startsWith("image/") &&
    !/\.(jpe?g|png|webp|gif|avif|bmp|hei[cf])$/i.test(file.name)
  ) {
    throw new Error("Please choose an image file.");
  }
  let sourceBlob: Blob = file;
  let url = URL.createObjectURL(sourceBlob);
  let image: HTMLImageElement;
  try {
    try {
      // Use native decoding first (including HEIC on supporting Apple browsers).
      image = await loadImage(url, signal);
    } catch (error) {
      if (signal.aborted || !isHeic(file)) throw error;
      const { default: heic2any } = await import("heic2any");
      if (signal.aborted)
        throw new DOMException("Upload canceled", "AbortError");
      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.92,
      });
      sourceBlob = Array.isArray(converted) ? converted[0] : converted;
      if (!sourceBlob) throw new Error("The HEIC file contains no image.");
      URL.revokeObjectURL(url);
      url = URL.createObjectURL(sourceBlob);
      image = await loadImage(url, signal);
    }
    const canvas = document.createElement("canvas");
    const size = fitPhotoSize(image.naturalWidth, image.naturalHeight);
    canvas.width = size.width;
    canvas.height = size.height;
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable.");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await canvasToBlob(canvas, "image/jpeg");
    } finally {
      image.src = "";
      canvas.width = canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
