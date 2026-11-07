import { canvasToBlob, coverCrop, loadImage } from "./images";

/** Each slot is a pair of local portraits, composed after both people approve a photo. */
export async function composeRoomPhoto(
  sources: string[],
  aspect: number,
  signal: AbortSignal,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(1200 * Math.min(1, aspect));
  canvas.height = Math.round(canvas.width / aspect);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable.");
  const horizontal = aspect >= 1;
  const width = horizontal ? canvas.width / 2 : canvas.width;
  const height = horizontal ? canvas.height : canvas.height / 2;
  try {
    for (let index = 0; index < 2; index++) {
      const image = await loadImage(sources[index], signal);
      try {
        const crop = coverCrop(
          image.naturalWidth,
          image.naturalHeight,
          width,
          height,
        );
        context.drawImage(
          image,
          crop.sx,
          crop.sy,
          crop.sw,
          crop.sh,
          horizontal ? index * width : 0,
          horizontal ? 0 : index * height,
          width,
          height,
        );
      } finally {
        image.src = "";
      }
    }
    signal.throwIfAborted();
    return await canvasToBlob(canvas, "image/jpeg");
  } finally {
    canvas.width = canvas.height = 0;
  }
}
