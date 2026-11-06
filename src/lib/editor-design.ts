import { defaultEffects, type PhotoEffects } from "./photo-filters";
import type { FramePreset } from "./frames";

export type FramePattern =
  | "none"
  | "dots"
  | "hearts"
  | "stars"
  | "stripes"
  | "checker"
  | "grid";
export type PhotoShape = "square" | "rounded" | "circle";
export interface PlacedSticker {
  id: string;
  src: string;
  name: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  flipped: boolean;
}
export interface Caption {
  text: string;
  font: "sans" | "playful" | "serif";
  color: string;
  size: number;
}
export interface EditorDesign {
  frame: FramePreset;
  borderColor: string;
  pattern: FramePattern;
  patternColor: string;
  padding: number;
  gap: number;
  photoShape: PhotoShape;
  effects: PhotoEffects;
  caption: Caption;
  stickers: readonly PlacedSticker[];
}
export const MAX_STICKERS = 24;
export function createDesign(): EditorDesign {
  return {
    frame: "rounded",
    borderColor: "#ffffff",
    pattern: "none",
    patternColor: "#ac83cc",
    padding: 16,
    gap: 8,
    photoShape: "square",
    effects: defaultEffects(),
    caption: { text: "", font: "playful", color: "#76578c", size: 16 },
    stickers: [],
  };
}
export function normalizeSticker(sticker: PlacedSticker): PlacedSticker {
  const finite = (value: number, fallback: number) =>
    Number.isFinite(value) ? value : fallback;
  return {
    ...sticker,
    x: Math.max(0, Math.min(1, finite(sticker.x, 0.5))),
    y: Math.max(0, Math.min(1, finite(sticker.y, 0.5))),
    size: Math.max(0.08, Math.min(0.8, finite(sticker.size, 0.28))),
    rotation: Math.max(-180, Math.min(180, finite(sticker.rotation, 0))),
  };
}
export function addSticker(design: EditorDesign, sticker: PlacedSticker) {
  return design.stickers.length >= MAX_STICKERS
    ? design.stickers
    : [...design.stickers, normalizeSticker(sticker)];
}
export const captionFont = (font: Caption["font"]) =>
  font === "playful"
    ? "var(--font-coiny), sans-serif"
    : font === "serif"
      ? "Georgia, serif"
      : "var(--font-geist-sans), sans-serif";
