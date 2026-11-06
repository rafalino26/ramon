export type FilterOperation = {
  name: "brightness" | "contrast" | "saturate" | "grayscale" | "sepia";
  value: number;
};
export const photoFilters = [
  { id: "normal", label: "Normal", operations: [] },
  { id: "b&w", label: "B&W", operations: [{ name: "grayscale", value: 1 }] },
  {
    id: "vintage",
    label: "Vintage",
    operations: [{ name: "sepia", value: 0.5 }],
  },
  { id: "vivid", label: "Vivid", operations: [{ name: "saturate", value: 2 }] },
  {
    id: "cool",
    label: "Cool",
    operations: [
      { name: "contrast", value: 1.2 },
      { name: "brightness", value: 1.1 },
    ],
  },
  {
    id: "warm",
    label: "Warm",
    operations: [
      { name: "brightness", value: 1.2 },
      { name: "saturate", value: 1.2 },
    ],
  },
  {
    id: "soft",
    label: "Soft",
    operations: [
      { name: "contrast", value: 0.85 },
      { name: "brightness", value: 1.1 },
      { name: "saturate", value: 0.85 },
    ],
  },
  {
    id: "fade",
    label: "Fade",
    operations: [
      { name: "contrast", value: 0.75 },
      { name: "sepia", value: 0.2 },
      { name: "brightness", value: 1.08 },
    ],
  },
  {
    id: "noir",
    label: "Noir",
    operations: [
      { name: "grayscale", value: 1 },
      { name: "contrast", value: 1.4 },
    ],
  },
  {
    id: "cream",
    label: "Cream",
    operations: [
      { name: "sepia", value: 0.3 },
      { name: "contrast", value: 0.9 },
      { name: "brightness", value: 1.12 },
    ],
  },
  {
    id: "dreamy",
    label: "Dreamy",
    operations: [
      { name: "contrast", value: 0.85 },
      { name: "saturate", value: 1.25 },
      { name: "brightness", value: 1.15 },
    ],
  },
  {
    id: "retro",
    label: "Retro",
    operations: [
      { name: "sepia", value: 0.65 },
      { name: "saturate", value: 1.6 },
      { name: "contrast", value: 1.15 },
    ],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  operations: readonly FilterOperation[];
}[];
export type PhotoFilterId = (typeof photoFilters)[number]["id"];
export interface PhotoEffects {
  preset: PhotoFilterId;
  intensity: number;
  brightness: number;
  contrast: number;
  saturation: number;
}
export const defaultEffects = (): PhotoEffects => ({
  preset: "normal",
  intensity: 100,
  brightness: 100,
  contrast: 100,
  saturation: 100,
});
export function getFilterOperations(effects: PhotoEffects): FilterOperation[] {
  const preset =
    photoFilters.find((filter) => filter.id === effects.preset) ??
    photoFilters[0];
  return [
    ...preset.operations.map((operation) => {
      const neutral =
        operation.name === "sepia" || operation.name === "grayscale" ? 0 : 1;
      return {
        name: operation.name,
        value:
          neutral + ((operation.value - neutral) * effects.intensity) / 100,
      };
    }),
    { name: "brightness" as const, value: effects.brightness / 100 },
    { name: "contrast" as const, value: effects.contrast / 100 },
    { name: "saturate" as const, value: effects.saturation / 100 },
  ].filter(
    (operation) =>
      operation.value !==
      (operation.name === "sepia" || operation.name === "grayscale" ? 0 : 1),
  );
}
export const effectsCss = (effects: PhotoEffects) =>
  getFilterOperations(effects)
    .map((operation) => `${operation.name}(${operation.value})`)
    .join(" ") || "none";
const clamp = (value: number) => Math.max(0, Math.min(255, value));

/** A single pixel pass, also used by older Safari without CanvasRenderingContext2D.filter. */
export function applyFilterOperations(
  data: Uint8ClampedArray,
  operations: readonly FilterOperation[],
) {
  for (let index = 0; index < data.length; index += 4) {
    let r = data[index],
      g = data[index + 1],
      b = data[index + 2];
    for (const { name, value } of operations) {
      if (name === "brightness") {
        r *= value;
        g *= value;
        b *= value;
      } else if (name === "contrast") {
        r = (r - 127.5) * value + 127.5;
        g = (g - 127.5) * value + 127.5;
        b = (b - 127.5) * value + 127.5;
      } else if (name === "grayscale") {
        const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r += (grey - r) * value;
        g += (grey - g) * value;
        b += (grey - b) * value;
      } else if (name === "saturate") {
        const grey = 0.213 * r + 0.715 * g + 0.072 * b;
        r = grey + value * (r - grey);
        g = grey + value * (g - grey);
        b = grey + value * (b - grey);
      } else if (name === "sepia") {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b;
        const sg = 0.349 * r + 0.686 * g + 0.168 * b;
        const sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r += (sr - r) * value;
        g += (sg - g) * value;
        b += (sb - b) * value;
      }
      r = clamp(r);
      g = clamp(g);
      b = clamp(b);
    }
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
  }
}
