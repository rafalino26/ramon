import { canvasToBlob, coverCrop, fitPhotoSize } from "./images";

import {
  photoFilters,
  effectsCss,
  defaultEffects,
  getFilterOperations,
  applyFilterOperations,
  type PhotoFilterId,
} from "./photo-filters";

export type CameraFilter = PhotoFilterId;
export const cameraFilters = photoFilters.map((filter) => ({
  label: filter.label,
  value: filter.id,
  css: effectsCss({ ...defaultEffects(), preset: filter.id }),
}));
export const filterCss = (preset: CameraFilter) =>
  effectsCss({ ...defaultEffects(), preset });

export function cameraConstraints(
  facingMode: "user" | "environment",
  deviceId: string,
): MediaTrackConstraints & { resizeMode: ConstrainDOMString } {
  // Camera capture formats are sensor-oriented. Portrait dimensions can make
  // Safari crop the source before the video element receives its first frame.
  // Keep this request independent of preview size, rotation and frame controls.
  return {
    width: { ideal: 1920 },
    height: { ideal: 1440 },
    resizeMode: { ideal: "none" },
    ...(deviceId
      ? { deviceId: { exact: deviceId } }
      : { facingMode: { ideal: facingMode } }),
  };
}

export function cameraFacing(track: MediaStreamTrack | undefined, fallback: string) {
  const reported = track?.getSettings().facingMode;
  if (reported === "user" || reported === "environment") return reported;
  const label = track?.label ?? "";
  if (/front|user|facetime/i.test(label)) return "user";
  if (/back|rear|environment/i.test(label)) return "environment";
  return fallback;
}
export function applyPixelFilter(
  data: Uint8ClampedArray,
  preset: CameraFilter,
) {
  applyFilterOperations(
    data,
    getFilterOperations({ ...defaultEffects(), preset }),
  );
}

export async function captureVideo(
  video: HTMLVideoElement,
  mirror: boolean,
  filter: CameraFilter,
  aspectRatio = video.videoWidth / video.videoHeight,
) {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    throw new Error("The camera is not ready yet.");
  }
  const canvas = document.createElement("canvas");
  const crop = coverCrop(video.videoWidth, video.videoHeight, aspectRatio, 1);
  const size = fitPhotoSize(crop.sw, crop.sh);
  canvas.width = size.width;
  canvas.height = size.height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    if (mirror) {
      context.translate(size.width, 0);
      context.scale(-1, 1);
    }
    const supportsFilter = typeof Reflect.get(context, "filter") === "string";
    if (supportsFilter) context.filter = filterCss(filter);
    context.drawImage(
      video,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      size.width,
      size.height,
    );
    if (!supportsFilter && filter !== "normal") {
      const pixels = context.getImageData(0, 0, size.width, size.height);
      applyPixelFilter(pixels.data, filter);
      context.putImageData(pixels, 0, 0);
    }
    return await canvasToBlob(canvas, "image/jpeg");
  } finally {
    canvas.width = canvas.height = 0;
  }
}
