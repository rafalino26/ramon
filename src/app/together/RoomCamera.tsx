"use client";
import { useEffect, useRef, useState } from "react";
import { captureVideo } from "@/lib/camera";
import { prepareUpload } from "@/lib/images";

export default function RoomCamera({
  onUse,
  disabled,
}: {
  onUse: (blob: Blob) => Promise<void>;
  disabled: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [opened, setOpened] = useState(false);
  const [ready, setReady] = useState(false);
  const [candidate, setCandidate] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!candidate) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(candidate);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [candidate]);
  useEffect(() => {
    if (!opened || candidate) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Camera access requires HTTPS or localhost. You can also upload a photo.",
      );
      setOpened(false);
      return;
    }
    let active = true;
    setReady(false);
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      })
      .then((media) => {
        if (!active) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        if (video.current) video.current.srcObject = media;
      })
      .catch((cause) => {
        if (active) {
          setError(cause.message);
          setOpened(false);
        }
      });
    return () => {
      active = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, [opened, candidate]);
  useEffect(() => () => controller.current?.abort(), []);
  const capture = async () => {
    if (!video.current) return;
    setWorking(true);
    setError("");
    try {
      setCandidate(await captureVideo(video.current, true, "normal", 0.75));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not capture the photo.",
      );
    } finally {
      setWorking(false);
    }
  };
  return (
    <section className="room-camera">
      {preview ? (
        <img src={preview} alt="Your photo before sharing" />
      ) : opened ? (
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          onLoadedData={() => setReady(true)}
        />
      ) : (
        <p>
          Your camera opens only when you choose. Approve your photo before
          sharing it.
        </p>
      )}
      <div className="room-actions">
        {candidate ? (
          <>
            <button
              className="button button-secondary"
              disabled={disabled || working}
              onClick={() => setCandidate(null)}
            >
              Retake
            </button>
            <button
              className="button button-primary"
              disabled={disabled || working}
              onClick={async () => {
                setWorking(true);
                try {
                  await onUse(candidate);
                  setCandidate(null);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Photo could not be shared.",
                  );
                } finally {
                  setWorking(false);
                }
              }}
            >
              Use this photo
            </button>
          </>
        ) : (
          <>
            <button
              className="button button-primary"
              disabled={disabled || working || (opened && !ready)}
              onClick={() =>
                opened ? void capture() : (setError(""), setOpened(true))
              }
            >
              {opened ? "Take photo" : "Open my camera"}
            </button>
            <label className="button button-secondary">
              Upload a photo
              <input
                className="sr-only"
                type="file"
                accept="image/*"
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
                          : "Unable to open photo.",
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
      {working && <p role="status">Preparing your photo…</p>}
      {error && (
        <p role="alert" className="notice-error">
          {error}
        </p>
      )}
    </section>
  );
}
