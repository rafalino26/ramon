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
    id: "full-nailong", name: "Full Nailong",
    color: "#fff3c4", accent: "#dfb15b", pattern: "none",
    assets: ["nailong-semangat", "nailong-melet", "nailong-headphone", "nailong-berdiri", "nailong-jungkir", "nailong-bajak-laut"],
  },
  {
    id: "nailong-playtime", name: "Nailong Playtime",
    color: "#ffedce", accent: "#dca474", pattern: "dots",
    assets: ["nailong-jungkir", "nailong-bajak-laut", "nailong-melet", "nailong-semangat", "nailong-berdiri", "nailong-headphone"],
  },
  {
    id: "nailong-chill", name: "Nailong Chill",
    color: "#f1eaff", accent: "#b5a0d2", pattern: "grid",
    assets: ["nailong-headphone", "nailong-manyun", "nailong-khawatir", "nailong-berdiri", "nailong-melet", "nailong-semangat"],
  },
  {
    id: "full-stitch", name: "Full Stitch",
    color: "#e5f1ff", accent: "#9ab9de", pattern: "none",
    assets: ["stitchblue", "stitchblue1", "stitchblue2", "stitchblue3", "stitchblue1", "stitchblue"],
  },
  {
    id: "stitch-party", name: "Stitch Party",
    color: "#e3f7f3", accent: "#a0c9c9", pattern: "dots",
    assets: ["stitchblue3", "stitchblue2", "stitchblue", "stitchblue1", "stitchblue3", "stitchblue2"],
  },
  {
    id: "full-angel", name: "Full Angel",
    color: "#fce8f3", accent: "#dba2c3", pattern: "none",
    assets: ["stitchpink", "stitchpink1", "stitchpink2", "stitchpink", "stitchpink2", "stitchpink1"],
  },
  {
    id: "full-flowers", name: "Full Flowers",
    color: "#f3f6e6", accent: "#a4b989", pattern: "none",
    assets: ["cute-daisy", "cute-tulip", "cute-cherry-blossom", "cute-sunflower", "cute-tulip", "cute-daisy"],
  },
  {
    id: "daisy-meadow", name: "Daisy Meadow",
    color: "#f5f7dd", accent: "#b9c788", pattern: "dots",
    assets: ["cute-daisy", "cute-daisy", "cute-daisy", "cute-daisy", "cute-daisy", "cute-daisy"],
  },
  {
    id: "tulip-bloom", name: "Tulip Bloom",
    color: "#ffedf3", accent: "#d6a4bb", pattern: "none",
    assets: ["cute-tulip", "cute-tulip", "cute-tulip", "cute-tulip", "cute-tulip", "cute-tulip"],
  },
  {
    id: "sunflower-day", name: "Sunflower Day",
    color: "#fff5d9", accent: "#d7b867", pattern: "dots",
    assets: ["cute-sunflower", "cute-sunflower", "cute-sunflower", "cute-sunflower", "cute-sunflower", "cute-sunflower"],
  },
  {
    id: "sakura-petals", name: "Sakura Petals",
    color: "#fff0f3", accent: "#e1b0bd", pattern: "none",
    assets: ["cute-cherry-blossom", "cute-cherry-blossom", "cute-cherry-blossom", "cute-cherry-blossom", "cute-cherry-blossom", "cute-cherry-blossom"],
  },
  {
    id: "full-hearts", name: "Full Hearts",
    color: "#f8eaff", accent: "#cea0cf", pattern: "hearts",
    assets: ["cute-purple-heart", "cute-two-hearts", "cute-pink-heart", "cute-purple-heart", "cute-pink-heart", "cute-two-hearts"],
  },
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
