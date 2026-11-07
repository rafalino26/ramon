import { canvasToBlob, coverCrop, loadImage } from "./images";

/** Each slot is a pair of local portraits, composed after both people approve a photo. */
export async function composeRoomPhoto(
  sources: (string | null)[],
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
      const source = sources[index];
      if (!source) {
        const x = horizontal ? index * width : 0,
          y = horizontal ? 0 : index * height;
        context.fillStyle = "#efe7fa";
        context.fillRect(x, y, width, height);
        context.fillStyle = "#80668f";
        context.font = "24px sans-serif";
        context.textAlign = "center";
        context.fillText(
          "Waiting for a portrait",
          x + width / 2,
          y + height / 2,
          width - 30,
        );
        continue;
      }
      const image = await loadImage(source, signal);
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
