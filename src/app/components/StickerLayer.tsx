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
    mode: "move" | "resize" | "rotate";
    centerX: number;
    centerY: number;
    distance: number;
    angle: number;
    size: number;
    rotation: number;
  } | null>(null);
  const start = (
    event: PointerEvent<HTMLButtonElement>,
    sticker: PlacedSticker,
    mode: "move" | "resize" | "rotate" = "move",
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    if (drag.current) return;
    const object =
      event.currentTarget.closest<HTMLElement>("[data-sticker-id]")!;
    const box = object.parentElement!.getBoundingClientRect();
    const centerX = box.x + sticker.x * box.width;
    const centerY = box.y + sticker.y * box.height;
    drag.current = {
      id: sticker.id,
      pointer: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: sticker.x,
      y: sticker.y,
      width: box.width,
      height: box.height,
      mode,
      centerX,
      centerY,
      distance: Math.max(
        1,
        Math.hypot(event.clientX - centerX, event.clientY - centerY),
      ),
      angle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
      size: sticker.size,
      rotation: sticker.rotation,
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
  const move = (
    event: PointerEvent<HTMLButtonElement>,
    sticker: PlacedSticker,
  ) => {
    const current = drag.current;
    if (current?.id !== sticker.id || current.pointer !== event.pointerId)
      return;
    if (current.mode === "resize") {
      onUpdate(sticker.id, {
        size:
          (current.size *
            Math.hypot(
              event.clientX - current.centerX,
              event.clientY - current.centerY,
            )) /
          current.distance,
      });
    } else if (current.mode === "rotate") {
      const angle = Math.atan2(
        event.clientY - current.centerY,
        event.clientX - current.centerX,
      );
      let rotation =
        current.rotation + ((angle - current.angle) * 180) / Math.PI;
      if (event.shiftKey) rotation = Math.round(rotation / 15) * 15;
      onUpdate(sticker.id, { rotation: ((rotation + 540) % 360) - 180 });
    } else {
      onUpdate(sticker.id, {
        x: current.x + (event.clientX - current.clientX) / current.width,
        y: current.y + (event.clientY - current.clientY) / current.height,
      });
    }
  };
  return (
    <>
      {stickers.map((sticker) => (
        <div
          key={sticker.id}
          data-sticker-id={sticker.id}
          className={`placed-sticker ${selected === sticker.id ? "is-selected" : ""}`}
          style={{
            left: `${sticker.x * 100}%`,
            top: `${sticker.y * 100}%`,
            width: `${sticker.size * 100}%`,
            transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
          }}
        >
          <button
            type="button"
            className="sticker-move"
            aria-label={`Move ${sticker.name}`}
            aria-pressed={selected === sticker.id}
            onClick={() => onSelect(sticker.id)}
            onPointerDown={(event) => start(event, sticker)}
            onPointerMove={(event) => move(event, sticker)}
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
          {selected === sticker.id &&
            (["rotate", "resize"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`sticker-handle sticker-handle-${mode}`}
                aria-label={
                  mode === "resize"
                    ? "Drag to resize sticker"
                    : "Drag to rotate sticker"
                }
                onPointerDown={(event) => start(event, sticker, mode)}
                onPointerMove={(event) => move(event, sticker)}
                onPointerUp={finish}
                onPointerCancel={finish}
                onLostPointerCapture={finish}
                onKeyDown={(event) => {
                  if (
                    ![
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(event.key)
                  )
                    return;
                  event.preventDefault();
                  const direction =
                    event.key === "ArrowRight" || event.key === "ArrowUp"
                      ? 1
                      : -1;
                  onUpdate(
                    sticker.id,
                    mode === "resize"
                      ? { size: sticker.size + direction * 0.02 }
                      : { rotation: sticker.rotation + direction * 5 },
                  );
                }}
              >
                {mode === "resize" ? "↔" : "↻"}
              </button>
            ))}
        </div>
      ))}
    </>
  );
}
