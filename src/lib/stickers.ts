export interface StickerAsset {
  id: string;
  name: string;
  src: string;
  category: "Nailong" | "Stitch" | "Cute";
}
const nailongNames = [
  "bajak-laut",
  "berdiri",
  "bunga",
  "hati",
  "headphone",
  "jungkir",
  "khawatir",
  "manyun",
  "melet",
  "semangat",
  ...Array.from(
    { length: 15 },
    (_, index) => `extra-${String(index + 1).padStart(2, "0")}`,
  ),
];
const stitchNames = [
  "stitchbareng",
  "stitchbareng1",
  "stitchbareng2",
  "stitchbareng3",
  "stitchblue",
  "stitchblue1",
  "stitchblue2",
  "stitchblue3",
  "stitchpink",
  "stitchpink1",
  "stitchpink2",
];
const cuteNames = [
  "cherry-blossom",
  "daisy",
  "tulip",
  "sunflower",
  "butterfly",
  "pink-bow",
  "pink-heart",
  "purple-heart",
  "two-hearts",
  "love-letter",
  "glowing-star",
  "sparkles",
  "rainbow",
  "cherries",
  "strawberry",
  "cake",
  "bubble-tea",
  "cat",
  "bear",
  "bunny",
  "frog",
  "panda",
  "duck",
  "mushroom",
];
export const stickerCatalog: readonly StickerAsset[] = [
  ...nailongNames.map((name) => ({
    id: `nailong-${name}`,
    name: `Nailong ${name.replaceAll("-", " ")}`,
    src: `/stickers/nailong/sticker-${name}.webp`,
    category: "Nailong" as const,
  })),
  ...stitchNames.map((name) => ({
    id: name,
    name: name
      .replace("stitchbareng", "Stitch together ")
      .replace("stitchblue", "Stitch blue ")
      .replace("stitchpink", "Angel pink ")
      .trim(),
    src: `/stickers/stitch/${name}.webp`,
    category: "Stitch" as const,
  })),
  ...cuteNames.map((name) => ({
    id: `cute-${name}`,
    name: name.replaceAll("-", " "),
    src: `/stickers/cute/${name}.svg`,
    category: "Cute" as const,
  })),
];
