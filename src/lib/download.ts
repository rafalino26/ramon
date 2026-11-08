export function isAppleMobile(
  device: Pick<Navigator, "userAgent" | "maxTouchPoints">,
): boolean {
  return (
    /iPad|iPhone|iPod/i.test(device.userAgent) ||
    (/Macintosh|MacIntel/i.test(device.userAgent) && device.maxTouchPoints > 1)
  );
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Revoking immediately (or after 1.5s) can interrupt Safari's file handoff.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

export function exportFilename(name: string, extension: string) {
  const clean = name.trim()
    .replace(/\.(png|jpe?g|pdf|webp)$/i, "")
    // Control characters are invalid in filenames on supported desktop systems.
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .slice(0, 100)
    .replace(/[. ]+$/g, "");
  return `${clean || "ramon-photobooth"}.${extension}`;
}

export async function copyImage(file: File) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image copying is unavailable here. Please download the PNG instead.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": file })]);
}

/** Invoke directly from the click handler, using a file prepared before the click. */
export async function saveFile(file: File): Promise<void> {
  if (
    isAppleMobile(navigator) &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: "Ramon Photobooth" });
      return;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      // A failed native share may consume activation, but the file remains available
      // for the normal download path. Never create an empty replacement image.
    }
  }
  downloadFile(file);
}
