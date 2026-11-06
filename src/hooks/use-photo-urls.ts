"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PhotoSlots } from "@/lib/photobooth-session";

/** The session owns URLs; tabs can unmount without losing their photos. */
export function usePhotoUrls(images: PhotoSlots) {
  const owned = useRef(new Set<string>());
  useEffect(() => {
    const active = new Set(images);
    for (const url of owned.current) {
      if (!active.has(url)) {
        URL.revokeObjectURL(url);
        owned.current.delete(url);
      }
    }
  }, [images]);

  useEffect(() => {
    const urls = owned.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  return useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    owned.current.add(url);
    return url;
  }, []);
}
