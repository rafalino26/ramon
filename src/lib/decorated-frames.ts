import { MAX_STICKERS, type EditorDesign, type PlacedSticker } from "./editor-design";
import { stickerCatalog } from "./stickers";

interface DecoratedFrame {
  id: string;
  name: string;
  color: string;
  accent: string;
  pattern: EditorDesign["pattern"];
  assets: readonly string[];
}

export const decoratedFrames: readonly DecoratedFrame[] = [
  {
    id: "nailong-sunshine", name: "Nailong Sunshine",
    color: "#fff4ce", accent: "#d7a758", pattern: "dots",
    assets: ["nailong-semangat", "cute-glowing-star", "cute-sunflower", "nailong-berdiri", "cute-sparkles", "cute-daisy"],
  },
  {
    id: "nailong-love", name: "Nailong Love",
    color: "#ffedf2", accent: "#dc92af", pattern: "hearts",
    assets: ["nailong-hati", "cute-two-hearts", "cute-pink-heart", "nailong-bunga", "cute-purple-heart", "cute-love-letter"],
  },
  {
    id: "stitch-blue", name: "Stitch Blue",
    color: "#e9f3ff", accent: "#91afd9", pattern: "stars",
    assets: ["stitchblue", "cute-sparkles", "cute-purple-heart", "stitchblue2", "cute-glowing-star", "cute-rainbow"],
  },
  {
    id: "stitch-angel", name: "Stitch & Angel",
    color: "#f4eaff", accent: "#bd93d8", pattern: "hearts",
    assets: ["stitchblue1", "cute-two-hearts", "cute-pink-bow", "stitchpink", "cute-purple-heart", "cute-cherry-blossom"],
  },
  {
    id: "daisy-garden", name: "Daisy Garden",
    color: "#f4f8e9", accent: "#9eb891", pattern: "dots",
    assets: ["cute-daisy", "cute-butterfly", "cute-tulip", "cute-sunflower", "cute-daisy", "cute-cherry-blossom"],
  },
  {
    id: "sweet-hearts", name: "Sweet Hearts",
    color: "#fff0f5", accent: "#e3a1b9", pattern: "hearts",
    assets: ["cute-two-hearts", "cute-pink-bow", "cute-purple-heart", "cute-love-letter", "cute-pink-heart", "cute-two-hearts"],
  },
  {
    id: "cherry-blossom", name: "Cherry Blossom",
    color: "#fff2ec", accent: "#dea5b5", pattern: "dots",
    assets: ["cute-cherry-blossom", "cute-butterfly", "cute-tulip", "cute-cherry-blossom", "cute-pink-heart", "cute-cherry-blossom"],
  },
  {
    id: "lavender-bows", name: "Lavender Bows",
    color: "#f3ecff", accent: "#b295d6", pattern: "stars",
    assets: ["cute-pink-bow", "cute-sparkles", "cute-purple-heart", "cute-pink-bow", "cute-glowing-star", "cute-butterfly"],
  },
];

const prefix = "frame-kit-";
export const isFrameDecoration = (sticker: PlacedSticker) => sticker.id.startsWith(prefix);
export const frameAsset = (id: string) => stickerCatalog.find(asset => asset.id === id)!;

/** Uses ordinary stickers so built-in frames share export, editing and room sync. */
export function decoratedFramePatch(
  design: EditorDesign,
  preset: DecoratedFrame,
  aspect: number,
): Partial<EditorDesign> | null {
  const custom = design.stickers.filter(sticker => !isFrameDecoration(sticker));
  if (custom.length + preset.assets.length > MAX_STICKERS) return null;
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const size = Math.max(0.08, 0.24 * Math.min(1, 1 / ratio));
  const positions = [
    [0, 0, -12], [0.5, 0, 8], [1, 0, 12],
    [1, 1, 10], [1, 0.5, -8], [0, 1, -10],
  ];
  const decorations: PlacedSticker[] = preset.assets.map((id, index) => {
    const asset = frameAsset(id);
    const [anchorX, anchorY, rotation] = positions[index];
    const stickerSize = Math.max(0.08, index === 1 || index === 4 ? size * 0.55 : size);
    const insetX = stickerSize * 0.62 + 0.015;
    const insetY = stickerSize * ratio * 0.62 + 0.015;
    return {
      id: `${prefix}${index}`,
      src: asset.src,
      name: `${preset.name} · ${asset.name}`,
      x: insetX + (1 - 2 * insetX) * anchorX,
      y: insetY + (1 - 2 * insetY) * anchorY,
      rotation,
      size: stickerSize,
      flipped: false,
    };
  });
  return {
    frame: "rounded", borderColor: preset.color,
    pattern: preset.pattern, patternColor: preset.accent,
    padding: 28, gap: 8, photoShape: "rounded",
    stickers: [...custom, ...decorations],
  };
}

export function selectedDecoratedFrame(design: EditorDesign) {
  const decorations = design.stickers.filter(isFrameDecoration);
  return decoratedFrames.find(preset =>
    decorations.length === preset.assets.length &&
    preset.assets.every((id, index) => decorations.some(sticker =>
      sticker.id === `${prefix}${index}` &&
      sticker.src === frameAsset(id).src &&
      sticker.name.startsWith(`${preset.name} · `),
    )),
  )?.id;
}
