"use client";

import { useEffect, useMemo, useState } from "react";
import { prepareLocalDraft, readLocalDraft, restoreLocalDraft, writeLocalDraft, type LocalDraft } from "@/lib/local-draft";
import type { PhotoboothSession } from "@/lib/photobooth-session";

export function useLocalDraft(session: PhotoboothSession, restore: (session: PhotoboothSession) => void, createSource: (blob: Blob) => string) {
  const [status, setStatus] = useState<"loading" | "prompt" | "active">("loading");
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const snapshot = useMemo(() => ({ images: session.images, design: session.design, layout: session.layout }), [session.images, session.design, session.layout]);
  const [savedSnapshot, setSavedSnapshot] = useState<typeof snapshot | null>(null);

  useEffect(() => {
    let active = true;
    readLocalDraft().then(value => {
      if (!active) return;
      setDraft(value);
      setStatus(value ? "prompt" : "active");
    }).catch(() => {
      if (!active) return;
      setStatus("active");
      setError("Local draft storage is unavailable. Download your photos before leaving.");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (status !== "active") return;
    const abort = new AbortController();
    setSaving(true);
    const timer = setTimeout(async () => {
      try {
        const value = snapshot.images.some(Boolean) || snapshot.design.stickers.length
          ? await prepareLocalDraft(snapshot, abort.signal) : null;
        abort.signal.throwIfAborted();
        await writeLocalDraft(value);
        if (abort.signal.aborted) return;
        setSavedAt(value?.savedAt ?? null);
        setError("");
        setSaving(false);
        setSavedSnapshot(snapshot);
      } catch {
        if (abort.signal.aborted) return;
        setSaving(false);
        setError("This draft could not be saved on your device. Please download your photos.");
      }
    }, 600);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [status, snapshot]);

  const resume = () => {
    if (!draft) return;
    try {
      restore(restoreLocalDraft(draft, createSource));
      setDraft(null);
      setSavedAt(draft.savedAt);
      setStatus("active");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "This draft could not be opened."); }
  };
  const discard = async () => {
    try {
      await writeLocalDraft(null);
      setDraft(null);
      setSavedAt(null);
      setStatus("active");
      setError("");
    } catch { setError("The saved draft could not be removed. Please try again."); }
  };
  return { status, draft, savedAt, error, saving: saving || (!error && status === "active" && savedSnapshot !== snapshot), resume, discard };
}
