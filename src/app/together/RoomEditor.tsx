"use client";
import { useEffect, useMemo, useState } from "react";
import Edit from "../components/edit";
import {
  createSession,
  sessionReducer,
  type SessionAction,
} from "@/lib/photobooth-session";
import type { LayoutInfo } from "@/lib/layout";
import type { EditorDesign } from "@/lib/editor-design";
import { usePhotoUrls } from "@/hooks/use-photo-urls";

export default function RoomEditor({
  layout,
  images,
  design,
  controller,
  busy,
  onPublish,
  onRetake,
  retakeCount = 1,
}: {
  layout: LayoutInfo;
  images: (string | null)[];
  design: EditorDesign;
  controller: boolean;
  busy: boolean;
  onPublish: (design: EditorDesign, pass: boolean) => Promise<void>;
  onRetake: () => void;
  retakeCount?: number;
}) {
  const [session, setSession] = useState(() => ({
    ...createSession(),
    layout,
    images,
    design,
    hasSelectedLayout: true,
  }));
  useEffect(() => {
    if (!controller)
      setSession({
        ...createSession(),
        layout,
        images,
        design,
        hasSelectedLayout: true,
      });
  }, [controller, layout, images, design]);
  const sources = useMemo(
    () =>
      [
        session.design,
        ...session.past,
        ...session.future,
        ...(session.transaction ? [session.transaction] : []),
      ].flatMap((value) => value.stickers.map((sticker) => sticker.src)),
    [session],
  );
  const createSource = usePhotoUrls(sources);
  const dispatch = (action: SessionAction) => {
    if (controller && !busy)
      setSession((previous) => ({
        ...sessionReducer(previous, action),
        images,
      }));
  };
  return (
    <>
      <div className="room-note">
        {controller
          ? "You have editing control. Share your changes when ready, or save and pass control to your partner."
          : "Your partner is editing. Their shared changes appear here. You can download the current shared design."}
      </div>
      {controller && (
        <div className="room-actions">
          <button
            className="button button-primary"
            disabled={busy || !!session.transaction}
            onClick={() => void onPublish(session.design, false)}
          >
            Share design changes
          </button>
          <button
            className="button button-secondary"
            disabled={busy || !!session.transaction}
            onClick={() => void onPublish(session.design, true)}
          >
            Save &amp; pass control
          </button>
          <button className="text-link" disabled={busy} onClick={onRetake}>
            {retakeCount === 1
              ? "Retake the last photo"
              : "Retake the last pair"}
          </button>
        </div>
      )}
      <Edit
        session={session}
        dispatch={dispatch}
        createStickerSource={createSource}
        onChooseLayout={() => {}}
        readOnly={!controller || busy}
      />
    </>
  );
}
