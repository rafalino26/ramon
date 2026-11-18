"use client";

import { useCallback, useMemo, useReducer } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FiLock } from "react-icons/fi";
import Layout from "@/app/components/LayoutPicker";
import { Flower } from "@/app/components/MemoryArt";
import {
  createSession,
  sessionReducer,
  type PhotoboothTab,
} from "@/lib/photobooth-session";
import { usePhotoUrls } from "@/hooks/use-photo-urls";
import { useLocalDraft } from "@/hooks/use-local-draft";

function LoadingPanel() {
  return (
    <div className="loading-panel" role="status">
      <Flower />
      <p>Getting your little studio ready…</p>
    </div>
  );
}
const Camera = dynamic(() => import("@/app/components/camera"), {
  ssr: false,
  loading: LoadingPanel,
});
const Edit = dynamic(() => import("@/app/components/edit"), {
  loading: LoadingPanel,
});
const tabs = [
  { label: "Layout", value: "layout", hint: "Find your shape" },
  { label: "Camera", value: "camera", hint: "Get in the frame" },
  { label: "Edit", value: "edit", hint: "Make it yours" },
] as const;

export default function PhotoboothClient() {
  const [session, dispatch] = useReducer(
    sessionReducer,
    undefined,
    createSession,
  );
  const { tab: activeTab, layout, images, hasSelectedLayout } = session;
  const ownedSources = useMemo(
    () => [
      ...images,
      ...[...session.past, ...session.future].flatMap(entry => entry.photoEdit ? [entry.photoEdit.source, entry.photoEdit.expected] : []),
      ...[
        session.design,
        ...session.past,
        ...session.future,
        ...(session.transaction ? [session.transaction] : []),
      ].flatMap((design) => design.stickers.map((sticker) => sticker.src)),
    ],
    [images, session.design, session.past, session.future, session.transaction],
  );
  const createPhotoUrl = usePhotoUrls(ownedSources);
  const localDraft = useLocalDraft(session, restored => dispatch({ type: "restore", session: restored }), createPhotoUrl);
  const setActiveTab = (tab: PhotoboothTab) => {
    dispatch({ type: "tab", tab });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const handlePhoto = useCallback(
    (index: number, blob: Blob | null) => {
      dispatch({
        type: "photo",
        index,
        source: blob ? createPhotoUrl(blob) : null,
      });
    },
    [createPhotoUrl],
  );

  if (localDraft.status === "loading") return <LoadingPanel />;
  if (localDraft.status === "prompt") {
    return (
      <div className="page-width studio">
        <section className="workspace draft-prompt" aria-labelledby="draft-heading">
          <Flower />
          <h1 id="draft-heading">Your little moment is still here.</h1>
          <p>Continue the photo session saved on this browser, or start fresh.</p>
          <p>{Array.isArray(localDraft.draft?.images) ? localDraft.draft.images.filter(Boolean).length : 0} photos · {new Date(localDraft.draft?.savedAt ?? 0).toLocaleString()}</p>
          {localDraft.error && <p role="alert" className="notice-error">{localDraft.error}</p>}
          <div className="draft-actions">
            <button type="button" className="button button-primary" onClick={localDraft.resume}>Continue draft</button>
            <button type="button" className="button button-secondary" onClick={() => void localDraft.discard()}>Start fresh</button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-width studio">
      <header className="studio-heading">
        <div>
          <span className="eyebrow">THE MEMORY STUDIO</span>
          <h1>
            Make it a moment<span className="playful-text">.</span>
          </h1>
          <p>A little creativity, a few lovely photos. All yours.</p>
          <Link className="text-link" href="/together">
            Make a memory together →
          </Link>
        </div>
        <span className="privacy-note">
          <FiLock /> Your photos stay with you
        </span>
      </header>
      {activeTab !== "camera" && (images.some(Boolean) || localDraft.error) && <p className="local-draft-status" role="status">
        {localDraft.error || (images.some(Boolean) ? localDraft.saving ? "Saving draft on this device…" : localDraft.savedAt ? "Draft saved on this device" : "" : "")}
      </p>}
      <nav className="studio-steps" aria-label="Photobooth steps">
        {tabs.map((tab, index) => (
          <button
            key={tab.value}
            type="button"
            className="studio-step"
            aria-label={tab.label}
            aria-current={activeTab === tab.value ? "step" : undefined}
            aria-controls="studio-panel"
            onClick={() => setActiveTab(tab.value)}
          >
            <span className="step-number" aria-hidden="true">
              0{index + 1}
            </span>
            <span>
              <strong>{tab.label}</strong>
              <small>{tab.hint}</small>
            </span>
          </button>
        ))}
      </nav>
      <section
        id="studio-panel"
        className="workspace"
        aria-label={`${activeTab} workspace`}
      >
        {activeTab === "layout" && (
          <Layout
            selectedLayout={hasSelectedLayout ? layout : null}
            images={images}
            onSelectLayout={(layout) => dispatch({ type: "layout", layout })}
            onPhotoChange={handlePhoto}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === "camera" && (
          <Camera
            layout={layout}
            images={images}
            onPhotoChange={handlePhoto}
            onReset={() => dispatch({ type: "reset" })}
            onCaptureComplete={() => setActiveTab("edit")}
          />
        )}
        {activeTab === "edit" && (
          <Edit
            session={session}
            dispatch={dispatch}
            createStickerSource={createPhotoUrl}
            onChooseLayout={() => setActiveTab("layout")}
            onApplyPhoto={async (index, source, blob) => {
              if (images[index] !== source) throw new Error("This photo changed. Reopen the updated photo.");
              dispatch({ type: "edit-photo", index, source: createPhotoUrl(blob), expected: source });
            }}
          />
        )}
      </section>
    </div>
  );
}
