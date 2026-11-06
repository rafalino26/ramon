"use client";

import { useRef, type PointerEvent } from "react";
import type { PlacedSticker } from "@/lib/editor-design";

interface Props {
  stickers: readonly PlacedSticker[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<PlacedSticker>) => void;
  onRemove: (id: string) => void;
  onBegin: () => void;
  onEnd: () => void;
}
export default function StickerLayer({
  stickers,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  onBegin,
  onEnd,
}: Props) {
  const drag = useRef<{
    id: string;
    pointer: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const start = (
    event: PointerEvent<HTMLButtonElement>,
    sticker: PlacedSticker,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.parentElement!.getBoundingClientRect();
    drag.current = {
      id: sticker.id,
      pointer: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: sticker.x,
      y: sticker.y,
      width: box.width,
      height: box.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    onBegin();
    onSelect(sticker.id);
  };
  const finish = () => {
    if (drag.current) {
      drag.current = null;
      onEnd();
    }
  };
  return (
    <>
      {stickers.map((sticker) => (
        <button
          type="button"
          key={sticker.id}
          data-sticker-id={sticker.id}
          className={`placed-sticker ${selected === sticker.id ? "is-selected" : ""}`}
          aria-label={`Move ${sticker.name}`}
          aria-pressed={selected === sticker.id}
          style={{
            left: `${sticker.x * 100}%`,
            top: `${sticker.y * 100}%`,
            width: `${sticker.size * 100}%`,
            transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
          }}
          onClick={() => onSelect(sticker.id)}
          onPointerDown={(event) => start(event, sticker)}
          onPointerMove={(event) => {
            const current = drag.current;
            if (
              current?.id === sticker.id &&
              current.pointer === event.pointerId
            )
              onUpdate(sticker.id, {
                x:
                  current.x + (event.clientX - current.clientX) / current.width,
                y:
                  current.y +
                  (event.clientY - current.clientY) / current.height,
              });
          }}
          onPointerUp={finish}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 0.05 : 0.01;
            const moves: Record<string, { x?: number; y?: number }> = {
              ArrowLeft: { x: sticker.x - step },
              ArrowRight: { x: sticker.x + step },
              ArrowUp: { y: sticker.y - step },
              ArrowDown: { y: sticker.y + step },
            };
            if (moves[event.key]) {
              event.preventDefault();
              onUpdate(sticker.id, moves[event.key]);
            }
            if (event.key === "Delete" || event.key === "Backspace") {
              event.preventDefault();
              onRemove(sticker.id);
            }
            if (event.key === "Escape") onSelect(null);
          }}
        >
          <img
            src={sticker.src}
            alt=""
            draggable={false}
            style={{ transform: sticker.flipped ? "scaleX(-1)" : undefined }}
          />
        </button>
      ))}
    </>
  );
}
