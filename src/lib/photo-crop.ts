import { canvasToBlob, coverCrop, fitPhotoSize, loadImage } from "./images";

export interface PhotoCrop {
  zoom: number;
  panX: number;
  panY: number;
  rotation: number;
}
export const initialPhotoCrop: PhotoCrop = { zoom: 1, panX: 0, panY: 0, rotation: 0 };

export function cropGeometry(width: number, height: number, aspect: number, crop: PhotoCrop) {
  if (!(width > 0 && height > 0 && Number.isFinite(aspect) && aspect > 0)) {
    throw new Error("This photo has no usable size.");
  }
  const rotation = ((Math.round(crop.rotation / 90) * 90) % 360 + 360) % 360;
  const rotatedWidth = rotation % 180 ? height : width;
  const rotatedHeight = rotation % 180 ? width : height;
  const zoom = Math.min(3, Math.max(1, crop.zoom));
  const base = coverCrop(rotatedWidth, rotatedHeight, aspect, 1);
  const sw = base.sw / zoom, sh = base.sh / zoom;
  return {
    rotatedWidth, rotatedHeight, rotation, sw, sh,
    sx: (rotatedWidth - sw) * (Math.max(-1, Math.min(1, crop.panX)) + 1) / 2,
    sy: (rotatedHeight - sh) * (Math.max(-1, Math.min(1, crop.panY)) + 1) / 2,
  };
}

export function paintPhotoCrop(canvas: HTMLCanvasElement, image: HTMLImageElement, aspect: number, crop: PhotoCrop) {
  const geometry = cropGeometry(image.naturalWidth, image.naturalHeight, aspect, crop);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo editing is unavailable.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.scale(canvas.width / geometry.sw, canvas.height / geometry.sh);
  context.translate(-geometry.sx, -geometry.sy);
  context.translate(geometry.rotatedWidth / 2, geometry.rotatedHeight / 2);
  context.rotate(geometry.rotation * Math.PI / 180);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  context.restore();
}

export async function cropPhoto(source: string, aspect: number, crop: PhotoCrop, signal: AbortSignal) {
  const image = await loadImage(source, signal);
  const canvas = document.createElement("canvas");
  try {
    signal.throwIfAborted();
    const geometry = cropGeometry(image.naturalWidth, image.naturalHeight, aspect, crop);
    const size = fitPhotoSize(geometry.sw, geometry.sh);
    canvas.width = size.width;
    canvas.height = size.height;
    paintPhotoCrop(canvas, image, aspect, crop);
    const blob = await canvasToBlob(canvas, "image/jpeg");
    signal.throwIfAborted();
    return blob;
  } finally {
    image.src = "";
    canvas.width = canvas.height = 0;
  }
}
