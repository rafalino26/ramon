"use client";

import { forwardRef, type CSSProperties } from "react";
import { FiCamera } from "react-icons/fi";
import {
  getCells,
  getCellStyle,
  getGridStyle,
  getLayoutAspect,
  type LayoutInfo,
} from "@/lib/layout";
import type { PhotoSlots } from "@/lib/photobooth-session";
import type { EditorDesign, PlacedSticker } from "@/lib/editor-design";
import { captionFont } from "@/lib/editor-design";
import { frameStyles } from "@/lib/frames";
import { patternSvg, decorationSvg, svgUrl } from "@/lib/frame-art";
import { effectsCss } from "@/lib/photo-filters";
import StickerLayer from "./StickerLayer";

interface Props {
  layout: LayoutInfo;
  images: PhotoSlots;
  design: EditorDesign;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onUpdateSticker: (id: string, patch: Partial<PlacedSticker>) => void;
  onRemoveSticker: (id: string) => void;
  onBegin: () => void;
  onEnd: () => void;
}
const PhotostripPreview = forwardRef<HTMLDivElement, Props>(
  (
    {
      layout,
      images,
      design,
      selected,
      onSelect,
      onUpdateSticker,
      onRemoveSticker,
      onBegin,
      onEnd,
    },
    ref,
  ) => {
    const narrow = getLayoutAspect(layout) < 0.6;
    const background = patternSvg(design.pattern, design.patternColor);
    const decoration = decorationSvg(design.frame, design.patternColor);
    const style = {
      backgroundColor: design.borderColor,
      backgroundImage: background ? `url("${svgUrl(background)}")` : undefined,
      // Reserve space for the widest frame so changing padding never shrinks photos.
      "--photo-width": `${Math.max(68, Math.min(308, 440 * getLayoutAspect(layout) - 32))}px`,
      width: "min(var(--photo-width), calc(100% - 90px))",
      boxSizing: "content-box",
      "--frame-space": `${narrow ? design.padding / 2 : design.padding}px`,
      "--photo-gap": `${design.gap}px`,
    } as CSSProperties;
    return (
      <div
        ref={ref}
        className={`photostrip ${frameStyles[design.frame]}`}
        style={style}
        data-testid="photostrip"
        onPointerDown={(event) => {
          if (!(event.target as HTMLElement).closest("[data-sticker-id]"))
            onSelect(null);
        }}
      >
        {decoration && (
          <img
            className="frame-decoration"
            src={svgUrl(decoration)}
            alt=""
            draggable={false}
          />
        )}
        <div className="photostrip-grid" style={getGridStyle(layout)}>
          {getCells(layout).map((cell, index) => (
            <div
              key={index}
              data-photo-slot={index}
              className={`photostrip-cell photo-shape-${design.photoShape}`}
              style={getCellStyle(cell)}
            >
              {images[index] ? (
                <img
                  src={images[index]!}
                  alt={`slot ${index + 1}`}
                  draggable={false}
                  style={{ filter: effectsCss(design.effects) }}
                />
              ) : (
                <FiCamera aria-label="Empty photo space" />
              )}
            </div>
          ))}
        </div>
        {design.caption.text && (
          <div
            className="strip-caption"
            data-caption
            style={{
              color: design.caption.color,
              fontFamily: captionFont(design.caption.font),
              fontSize: `min(${design.caption.size}px, ${100 / (Math.max(1, design.caption.text.length) * 0.85)}cqw)`,
            }}
          >
            <span data-caption-text>{design.caption.text}</span>
            <span data-caption-baseline className="caption-baseline" />
          </div>
        )}
        <StickerLayer
          stickers={design.stickers}
          selected={selected}
          onSelect={onSelect}
          onUpdate={onUpdateSticker}
          onRemove={onRemoveSticker}
          onBegin={onBegin}
          onEnd={onEnd}
        />
      </div>
    );
  },
);
PhotostripPreview.displayName = "PhotostripPreview";
export default PhotostripPreview;
