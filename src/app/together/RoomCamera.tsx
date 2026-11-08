"use client";
import { useEffect, useRef, useState } from "react";
import { FiCamera, FiUpload } from "react-icons/fi";
import Camera from "../components/camera";
import { prepareUpload } from "@/lib/images";
import type { LayoutInfo } from "@/lib/layout";

export default function RoomCamera({
  onUse,
  disabled,
  active = true,
  layout,
  images,
  targetSlot,
}: {
  onUse: (blob: Blob) => Promise<void>;
  disabled: boolean;
  active?: boolean;
  layout: LayoutInfo;
  images: readonly (string | null)[];
  targetSlot: number | null;
}) {
  const [opened, setOpened] = useState(false);
  const [candidate, setCandidate] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!candidate) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(candidate);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [candidate]);
  useEffect(() => () => controller.current?.abort(), []);
  const share = async (blob: Blob) => {
    setWorking(true);
    setError("");
    try {
      await onUse(blob);
      setCandidate(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Photo could not be shared.",
      );
      throw cause;
    } finally {
      setWorking(false);
    }
  };
  return (
    <section className="room-camera-studio">
      {active && opened && !candidate && (
        <Camera
          layout={layout}
          images={images}
          showRoll={false}
          captureIndex={targetSlot}
          disabled={disabled || working}
          captureLabel="Take & share photo"
          resetLabel="Reset camera"
          onPhotoChange={async (_, blob) => {
            if (blob) await share(blob);
          }}
          onReset={() => {}}
          onCaptureComplete={() => {}}
        />
      )}
      {!opened && !preview && (
        <div className="room-camera-empty">
          <FiCamera />
          <h3>Your good side, together.</h3>
          <p>Use your camera or choose a photo from your device.</p>
        </div>
      )}
      {preview && (
        <img
          className="room-photo-review"
          src={preview}
          alt="Your photo before sharing"
        />
      )}
      <div className="room-actions">
        {candidate ? (
          <>
            <button
              className="button button-secondary"
              disabled={disabled || working}
              onClick={() => setCandidate(null)}
            >
              Choose another photo
            </button>
            <button
              className="button button-primary"
              disabled={disabled || working}
              onClick={() => void share(candidate).catch(() => {})}
            >
              Use this photo
            </button>
          </>
        ) : (
          <>
            {!opened && (
              <button
                className="button button-primary"
                disabled={disabled || working}
                onClick={() => {
                  setError("");
                  setOpened(true);
                }}
              >
                <FiCamera /> Open my camera
              </button>
            )}
            {opened && (
              <button
                className="button button-secondary"
                onClick={() => setOpened(false)}
              >
                Close camera
              </button>
            )}
            <label className="button button-secondary room-upload-button">
              <FiUpload /> Upload a photo
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                aria-label="Upload a room photo"
                disabled={disabled || working}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  controller.current?.abort();
                  const abort = new AbortController();
                  controller.current = abort;
                  setWorking(true);
                  setError("");
                  try {
                    setCandidate(await prepareUpload(file, abort.signal));
                  } catch (cause) {
                    if (!abort.signal.aborted)
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not open this photo.",
                      );
                  } finally {
                    if (!abort.signal.aborted) setWorking(false);
                  }
                }}
              />
            </label>
          </>
        )}
      </div>
      {working && <p role="status">Preparing and sharing your photo…</p>}
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}
    </section>
  );
}
