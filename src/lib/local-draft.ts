import { createSession, type PhotoboothSession } from "./photobooth-session";
import { layouts, getSlotCount } from "./layout";
import type { EditorDesign } from "./editor-design";

export interface LocalDraft {
  version: 1;
  savedAt: number;
  layoutId: string;
  images: (string | null)[];
  design: EditorDesign;
  blobs: Record<string, { bytes: ArrayBuffer; type: string }>;
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("ramon-local-draft", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Local draft storage is busy in another tab."));
  });
}

export async function readLocalDraft(): Promise<LocalDraft | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("drafts").objectStore("drafts").get("latest");
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function writeLocalDraft(draft: LocalDraft | null) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite");
      const store = transaction.objectStore("drafts");
      if (draft) store.put(draft, "latest");
      else store.delete("latest");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("The draft could not be saved."));
    });
  } finally { db.close(); }
}

export async function prepareLocalDraft(session: Pick<PhotoboothSession, "images" | "design" | "layout">, signal: AbortSignal): Promise<LocalDraft> {
  const sources = new Set([
    ...session.images,
    ...session.design.stickers.map(sticker => sticker.src),
  ].filter((source): source is string => !!source && source.startsWith("blob:")));
  const entries = await Promise.all([...sources].map(async source => {
    const response = await fetch(source, { signal });
    if (!response.ok) throw new Error("A photo is no longer available for draft saving.");
    const blob = await response.blob();
    // Store bytes: Safari can abort IndexedDB transactions containing Blob values.
    return [source, { bytes: await blob.arrayBuffer(), type: blob.type }] as const;
  }));
  signal.throwIfAborted();
  return {
    version: 1, savedAt: Date.now(), layoutId: session.layout.id,
    images: [...session.images], design: session.design,
    blobs: Object.fromEntries(entries),
  };
}

export function restoreLocalDraft(draft: LocalDraft, createSource: (blob: Blob) => string): PhotoboothSession {
  const layout = layouts.find(item => item.id === draft.layoutId);
  if (draft.version !== 1 || !layout || !Array.isArray(draft.images) || draft.images.length !== getSlotCount(layout) || !Array.isArray(draft.design?.stickers)) {
    throw new Error("This draft is no longer compatible. Please start a new session.");
  }
  const sources = [...draft.images.filter(Boolean), ...draft.design.stickers.map(sticker => sticker.src)];
  if (sources.some(source => typeof source !== "string" || (!source.startsWith("/stickers/") && !(draft.blobs?.[source]?.bytes instanceof ArrayBuffer)))) {
    throw new Error("A photo is missing from this draft.");
  }
  const urls = new Map<string, string>();
  const restore = (source: string) => {
    if (source.startsWith("/stickers/")) return source;
    if (!draft.blobs[source]) throw new Error("A photo is missing from this draft.");
    const asset = draft.blobs[source];
    if (!urls.has(source)) urls.set(source, createSource(new Blob([asset.bytes], { type: asset.type })));
    return urls.get(source)!;
  };
  return {
    ...createSession(), tab: "edit", layout, hasSelectedLayout: true,
    images: draft.images.map(source => source ? restore(source) : null),
    design: { ...draft.design, stickers: draft.design.stickers.map(sticker => ({ ...sticker, src: restore(sticker.src) })) },
  };
}
