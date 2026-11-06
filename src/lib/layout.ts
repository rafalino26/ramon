export type LayoutCategory = "Strips" | "Grids" | "Portrait" | "Creative";
export interface LayoutCell {
  col: number;
  row: number;
  cols?: number;
  rows?: number;
}
export interface LayoutInfo {
  id: string;
  label: string;
  rows: number;
  cols: number;
  category: LayoutCategory;
  photoAspect?: number;
  cells?: readonly LayoutCell[];
}

export const layouts: readonly LayoutInfo[] = [
  { id: "4x1", label: "4 x 1", rows: 4, cols: 1, category: "Strips" },
  { id: "3x1", label: "3 x 1", rows: 3, cols: 1, category: "Strips" },
  { id: "2x1", label: "2 x 1", rows: 2, cols: 1, category: "Strips" },
  { id: "3x2", label: "3 x 2", rows: 3, cols: 2, category: "Grids" },
  { id: "1x2", label: "1 x 2", rows: 1, cols: 2, category: "Grids" },
  { id: "2x3", label: "2 x 3", rows: 2, cols: 3, category: "Grids" },
  { id: "2x2", label: "2 x 2", rows: 2, cols: 2, category: "Grids" },
  { id: "1x1", label: "1 x 1", rows: 1, cols: 1, category: "Grids" },
  { id: "5x1", label: "5 x 1", rows: 5, cols: 1, category: "Strips" },
  { id: "6x1", label: "6 x 1", rows: 6, cols: 1, category: "Strips" },
  { id: "1x3", label: "1 x 3", rows: 1, cols: 3, category: "Grids" },
  { id: "1x4", label: "1 x 4", rows: 1, cols: 4, category: "Grids" },
  { id: "2x4", label: "2 x 4", rows: 2, cols: 4, category: "Grids" },
  { id: "4x2", label: "4 x 2", rows: 4, cols: 2, category: "Grids" },
  { id: "3x3", label: "3 x 3", rows: 3, cols: 3, category: "Grids" },
  {
    id: "portrait-solo",
    label: "Portrait solo",
    rows: 1,
    cols: 1,
    photoAspect: 0.75,
    category: "Portrait",
  },
  {
    id: "portrait-pair",
    label: "Portrait pair",
    rows: 1,
    cols: 2,
    photoAspect: 0.75,
    category: "Portrait",
  },
  {
    id: "portrait-trio",
    label: "Portrait trio",
    rows: 3,
    cols: 1,
    photoAspect: 0.75,
    category: "Portrait",
  },
  {
    id: "portrait-strip",
    label: "Portrait strip",
    rows: 4,
    cols: 1,
    photoAspect: 0.75,
    category: "Portrait",
  },
  {
    id: "wide-pair",
    label: "Wide pair",
    rows: 2,
    cols: 1,
    photoAspect: 4 / 3,
    category: "Strips",
  },
  {
    id: "wide-trio",
    label: "Wide trio",
    rows: 3,
    cols: 1,
    photoAspect: 4 / 3,
    category: "Strips",
  },
  {
    id: "spotlight",
    label: "Spotlight",
    rows: 3,
    cols: 2,
    category: "Creative",
    cells: [
      { col: 0, row: 0, cols: 2, rows: 2 },
      { col: 0, row: 2 },
      { col: 1, row: 2 },
    ],
  },
  {
    id: "side-story",
    label: "Side story",
    rows: 2,
    cols: 3,
    category: "Creative",
    cells: [
      { col: 0, row: 0, cols: 2, rows: 2 },
      { col: 2, row: 0 },
      { col: 2, row: 1 },
    ],
  },
  {
    id: "mosaic",
    label: "Memory mosaic",
    rows: 3,
    cols: 3,
    category: "Creative",
    cells: [
      { col: 0, row: 0, cols: 2, rows: 2 },
      { col: 2, row: 0 },
      { col: 2, row: 1 },
      { col: 0, row: 2 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ],
  },
  {
    id: "panorama",
    label: "Panorama mix",
    rows: 2,
    cols: 2,
    category: "Creative",
    cells: [
      { col: 0, row: 0, cols: 2 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ],
  },
];

export type LayoutId = string;
export const DEFAULT_LAYOUT = layouts.find((layout) => layout.id === "2x2")!;
export const getCells = (layout: LayoutInfo): readonly LayoutCell[] =>
  layout.cells ??
  Array.from({ length: layout.rows * layout.cols }, (_, index) => ({
    col: index % layout.cols,
    row: Math.floor(index / layout.cols),
  }));
export const getSlotCount = (layout: LayoutInfo) =>
  layout.cells?.length ?? layout.rows * layout.cols;
export const getLayoutAspect = (layout: LayoutInfo) =>
  (layout.cols * (layout.photoAspect ?? 1)) / layout.rows;
export function getCellStyle(cell: LayoutCell) {
  return {
    gridColumn: `${cell.col + 1} / span ${cell.cols ?? 1}`,
    gridRow: `${cell.row + 1} / span ${cell.rows ?? 1}`,
  };
}
export function getGridStyle(layout: LayoutInfo) {
  return {
    gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
    aspectRatio: String(getLayoutAspect(layout)),
  };
}
export function createSlots(layout: LayoutInfo): (string | null)[] {
  return Array.from({ length: getSlotCount(layout) }, () => null);
}
