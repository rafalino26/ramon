import type { FramePattern } from "./editor-design";
import type { FramePreset } from "./frames";

export const svgUrl = (markup: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
interface ArtPath {
  d: string;
  stroke?: number;
  dash?: number[];
  transform?: [x: number, y: number, scale: number];
}
const patternPaths: Record<Exclude<FramePattern, "none">, ArtPath[]> = {
  dots: [
    {
      d: "M7.8 6a1.8 1.8 0 1 0-3.6 0 1.8 1.8 0 1 0 3.6 0ZM19.8 18a1.8 1.8 0 1 0-3.6 0 1.8 1.8 0 1 0 3.6 0Z",
    },
  ],
  hearts: [
    { d: "M12 18 5 11C0 5 8 1 12 7c4-6 12-2 7 4Z", transform: [2, 2, 0.7] },
  ],
  stars: [
    {
      d: "m12 3 2.6 5.5 6 .8-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.3-4.2 6-.8Z",
      transform: [2, 2, 0.7],
    },
  ],
  stripes: [{ d: "M-6 24 24-6M6 30 30 6", stroke: 5 }],
  checker: [{ d: "M0 0h12v12H0Zm12 12h12v12H12Z" }],
  grid: [{ d: "M0 0h24v24H0Z", stroke: 1 }],
};
const rectPath = (
  x: number,
  y: number,
  width: number,
  height: number,
  radius = 0,
) =>
  `M${x + radius} ${y}h${width - 2 * radius}q${radius} 0 ${radius} ${radius}v${height - 2 * radius}q0 ${radius} ${-radius} ${radius}h${-width + 2 * radius}q${-radius} 0 ${-radius} ${-radius}v${-height + 2 * radius}q0 ${-radius} ${radius} ${-radius}Z`;
function decorationPaths(frame: FramePreset): ArtPath[] {
  if (frame === "film")
    return Array.from({ length: 8 }, (_, i) => [
      { d: rectPath(5 + i * 12, 1.5, 5, 2, 0.4) },
      { d: rectPath(5 + i * 12, 96.5, 5, 2, 0.4) },
    ]).flat();
  if (frame === "double" || frame === "inset")
    return [
      { d: rectPath(2.5, 2.5, 95, 95, 1), stroke: 0.5 },
      ...(frame === "double"
        ? [{ d: rectPath(4, 4, 92, 92, 1), stroke: 0.25 }]
        : []),
    ];
  if (frame === "postcard")
    return [
      { d: rectPath(82, 85, 12, 10), stroke: 0.45, dash: [1, 1] },
      { d: "M8 86h55M8 90h45M8 94h50", stroke: 0.45 },
    ];
  return [];
}
function artSvg(
  paths: ArtPath[],
  size: number,
  color: string,
  opacity = 1,
): string | null {
  if (!paths.length) return null;
  const art = paths
    .map(
      ({ d, stroke, dash, transform }) =>
        `<path d="${d}"${stroke ? ` fill="none" stroke="${color}" stroke-width="${stroke}"` : ""}${dash ? ` stroke-dasharray="${dash.join(" ")}"` : ""}${transform ? ` transform="translate(${transform[0]} ${transform[1]}) scale(${transform[2]})"` : ""}/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" preserveAspectRatio="none" fill="${color}"><g opacity="${opacity}">${art}</g></svg>`;
}
export const patternSvg = (pattern: FramePattern, color: string) =>
  artSvg(pattern === "none" ? [] : patternPaths[pattern], 24, color, 0.28);
export const decorationSvg = (frame: FramePreset, color: string) =>
  artSvg(decorationPaths(frame), 100, frame === "film" ? "#fff" : color);

function paintPaths(
  context: CanvasRenderingContext2D,
  paths: ArtPath[],
  color: string,
) {
  for (const { d, stroke, dash, transform } of paths) {
    context.save();
    if (transform) {
      context.translate(transform[0], transform[1]);
      context.scale(transform[2], transform[2]);
    }
    const path = new Path2D(d);
    if (stroke) {
      context.strokeStyle = color;
      context.lineWidth = stroke;
      context.setLineDash(dash ?? []);
      context.stroke(path);
    } else {
      context.fillStyle = color;
      context.fill(path);
    }
    context.restore();
  }
}

/** Native paths avoid SVG-image canvas tainting in WebKit/iPad exports. */
export function paintFrameArt(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  pattern: FramePattern,
  frame: FramePreset,
  color: string,
) {
  if (pattern !== "none") {
    const tile = document.createElement("canvas");
    const ratio = Math.ceil(Math.min(8, Math.max(1, context.getTransform().a)));
    tile.width = tile.height = 24 * ratio;
    try {
      const painter = tile.getContext("2d");
      if (!painter) throw new Error("Unable to draw the frame pattern.");
      painter.scale(ratio, ratio);
      painter.globalAlpha = 0.28;
      paintPaths(painter, patternPaths[pattern], color);
      const repeating = context.createPattern(tile, "repeat");
      if (!repeating) throw new Error("Unable to repeat the frame pattern.");
      repeating.setTransform(new DOMMatrix().scale(1 / ratio));
      context.save();
      context.fillStyle = repeating;
      context.fillRect(0, 0, width, height);
      context.restore();
    } finally {
      tile.width = tile.height = 0;
    }
  }
  context.save();
  context.scale(width / 100, height / 100);
  paintPaths(
    context,
    decorationPaths(frame),
    frame === "film" ? "#fff" : color,
  );
  context.restore();
}
