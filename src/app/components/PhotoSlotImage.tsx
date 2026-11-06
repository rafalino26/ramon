"use client";

import { FiTrash2 } from "react-icons/fi";

interface PhotoSlotImageProps {
  source: string | null;
  alt: string;
  onDelete: () => void;
}

export default function PhotoSlotImage({
  source,
  alt,
  onDelete,
}: PhotoSlotImageProps) {
  if (!source) return null;
  return (
    <>
      <img
        src={source}
        className="photo-slot-image"
        alt={alt}
        decoding="async"
      />
      <button
        type="button"
        className="delete-photo"
        aria-label={`Delete ${alt.toLowerCase()}`}
        onClick={onDelete}
      >
        <FiTrash2 />
      </button>
    </>
  );
}
