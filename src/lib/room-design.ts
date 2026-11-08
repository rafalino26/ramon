import {
  createDesign,
  MAX_STICKERS,
  type EditorDesign,
  type PlacedSticker,
} from "./editor-design";

export interface DesignChange {
  path: string[];
  value: unknown;
  before: unknown;
  expected?: unknown;
}

function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    Array.isArray(a) === Array.isArray(b) &&
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) => Object.hasOwn(right, key) && equal(left[key], right[key]),
    )
  );
}
const scalarFields = [
  "frame",
  "borderColor",
  "pattern",
  "patternColor",
  "padding",
  "gap",
  "photoShape",
] as const;
const stickerFields = [
  "src",
  "name",
  "x",
  "y",
  "size",
  "rotation",
  "flipped",
] as const;

/** Describe only the properties edited locally, preserving unrelated remote work. */
export function diffDesign(
  before: EditorDesign,
  after: EditorDesign,
): DesignChange[] {
  const changes: DesignChange[] = [];
  const add = (path: string[], previous: unknown, value: unknown) => {
    if (!equal(previous, value))
      changes.push({ path, before: previous, value });
  };
  for (const field of scalarFields) add([field], before[field], after[field]);
  for (const section of ["caption", "effects"] as const) {
    const previous = before[section] as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(after[section]))
      add([section, field], previous[field], value);
  }
  const oldStickers = new Map(
    before.stickers.map((sticker) => [sticker.id, sticker]),
  );
  const newStickers = new Map(
    after.stickers.map((sticker) => [sticker.id, sticker]),
  );
  for (const sticker of before.stickers) {
    if (!newStickers.has(sticker.id))
      add(["stickers", sticker.id], sticker, null);
  }
  for (const sticker of after.stickers) {
    const previous = oldStickers.get(sticker.id);
    if (!previous) add(["stickers", sticker.id], null, sticker);
    else
      for (const field of stickerFields)
        add(["stickers", sticker.id, field], previous[field], sticker[field]);
  }
  // Adds append automatically. Only an explicit layer reorder changes ordering.
  const commonBefore = before.stickers
    .filter((sticker) => newStickers.has(sticker.id))
    .map((sticker) => sticker.id);
  const commonAfter = after.stickers
    .filter((sticker) => oldStickers.has(sticker.id))
    .map((sticker) => sticker.id);
  if (!equal(commonBefore, commonAfter))
    add(
      ["stickerOrder"],
      before.stickers.map((s) => s.id),
      after.stickers.map((s) => s.id),
    );
  return changes;
}

export function applyDesignChanges(
  design: EditorDesign,
  changes: readonly DesignChange[],
): EditorDesign {
  const result = structuredClone(design);
  for (const change of changes) {
    const [section, id, field] = change.path;
    if (section === "stickerOrder") {
      const ids = change.value as string[];
      const current = result.stickers.map((sticker) => sticker.id);
      if ("expected" in change && !equal(current, change.expected)) continue;
      const byId = new Map(
        result.stickers.map((sticker) => [sticker.id, sticker]),
      );
      result.stickers = [...new Set([...ids, ...current])].flatMap((key) =>
        byId.has(key) ? [byId.get(key)!] : [],
      );
    } else if (section === "stickers") {
      const index = result.stickers.findIndex((sticker) => sticker.id === id);
      const sticker = result.stickers[index];
      const current = field
        ? (sticker?.[field as keyof PlacedSticker] ?? null)
        : (sticker ?? null);
      if ("expected" in change && !equal(current, change.expected)) continue;
      if (field) {
        if (sticker)
          result.stickers = result.stickers.map((item) =>
            item.id === id ? { ...item, [field]: change.value } : item,
          );
      } else if (change.value === null)
        result.stickers = result.stickers.filter((item) => item.id !== id);
      else if (!sticker && result.stickers.length < MAX_STICKERS)
        result.stickers = [...result.stickers, change.value as PlacedSticker];
    } else {
      const target = id ? result[section as "caption" | "effects"] : result;
      const record = target as unknown as Record<string, unknown>;
      const key = id ?? section;
      if (!("expected" in change) || equal(record[key], change.expected))
        record[key] = change.value;
    }
  }
  return result;
}

export function inverseChanges(
  changes: readonly DesignChange[],
): DesignChange[] {
  return [...changes].reverse().map((change) => ({
    path: change.path,
    before: change.value,
    value: change.before,
    expected: change.value,
  }));
}

/** A drag/typing transaction is one local undo step, even while it syncs. */
export function coalesceChanges(
  changes: readonly DesignChange[],
): DesignChange[] {
  const fields = new Map<string, DesignChange>();
  for (const change of changes) {
    const key = JSON.stringify(change.path);
    fields.set(key, {
      ...change,
      before: fields.has(key) ? fields.get(key)!.before : change.before,
    });
  }
  return [...fields.values()].filter(
    (change) => !equal(change.before, change.value),
  );
}

export const roomDesign = (design: EditorDesign | null) =>
  design ?? createDesign();

export function mapChangeSources(
  change: DesignChange,
  source: (src: string) => string,
): DesignChange {
  if (change.path[0] !== "stickers") return change;
  const map = (value: unknown) => {
    if (change.path[2] === "src" && typeof value === "string")
      return source(value);
    if (
      change.path.length === 2 &&
      value &&
      typeof value === "object" &&
      "src" in value
    ) {
      const sticker = value as PlacedSticker;
      return { ...sticker, src: source(sticker.src) };
    }
    return value;
  };
  return {
    ...change,
    value: map(change.value),
    before: map(change.before),
    ...("expected" in change ? { expected: map(change.expected) } : {}),
  };
}
