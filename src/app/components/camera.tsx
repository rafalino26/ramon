"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Webcam from "react-webcam";
import {
  FiArrowRight,
  FiCamera,
  FiCheck,
  FiClock,
  FiMaximize2,
  FiRefreshCw,
  FiRepeat,
  FiMinimize2,
} from "react-icons/fi";
import { Flower, MiniScene } from "./MemoryArt";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  getSlotCount,
  getCells,
  getCellStyle,
  getGridStyle,
  getLayoutAspect,
  type LayoutInfo,
} from "@/lib/layout";
import type { PhotoSlots } from "@/lib/photobooth-session";
import {
  cameraFilters,
  filterCss,
  captureVideo,
  type CameraFilter,
} from "@/lib/camera";
import PhotoSlotImage from "./PhotoSlotImage";

interface CameraProps {
  layout: LayoutInfo;
  images: PhotoSlots;
  onPhotoChange: (index: number, blob: Blob | null) => void | Promise<void>;
  onReset: () => void;
  onCaptureComplete: () => void;
  showRoll?: boolean;
  captureIndex?: number | null;
  disabled?: boolean;
  resetLabel?: string;
  captureLabel?: string;
}

export default function Camera({
  layout,
  images: capturedImages,
  onPhotoChange,
  onReset,
  onCaptureComplete,
  showRoll = true,
  captureIndex = null,
  disabled = false,
  resetLabel = "Reset",
  captureLabel,
}: CameraProps) {
  const webcamRef = useRef<Webcam>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const portrait = useMediaQuery(
    "(max-width: 639px) and (orientation: portrait)",
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const captureController = useRef<AbortController | null>(null);
  const shutterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [timer, setTimer] = useState(0);
  const [filter, setFilter] = useState<CameraFilter>("normal");
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isWidescreen, setIsWidescreen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceIndex, setActiveDeviceIndex] = useState<number | null>(
    null,
  );
  const [shutterOn, setShutterOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [actualFacing, setActualFacing] = useState("");
  const [mirrorOverride, setMirrorOverride] = useState<boolean | null>(null);
  const [focused, setFocused] = useState(false);
  const focusButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focused) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFocused(false);
        focusButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [focused]);

  const previewAspectRatio = isWidescreen ? 16 / 9 : portrait ? 3 / 4 : 4 / 3;

  useEffect(() => {
    captureController.current?.abort();
    captureController.current = null;
    setIsCapturing(false);
    setCountdown(0);
    setCameraReady(false);
  }, [previewAspectRatio]);

  const totalSlots = getSlotCount(layout);
  const capturedCount = capturedImages.filter(Boolean).length;
  const isComplete = capturedCount === totalSlots && captureIndex === null;
  const mirrored = mirrorOverride ?? (actualFacing || facingMode) === "user";
  const relevantCameras = useMemo(() => {
    const pattern =
      facingMode === "user" ? /front|user|facetime/i : /back|rear|environment/i;
    return devices.filter(
      (device) => device.kind === "videoinput" && pattern.test(device.label),
    );
  }, [devices, facingMode]);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (active)
          setDevices((previous) =>
            previous.length === devices.length &&
            previous.every(
              (device, index) =>
                device.deviceId === devices[index].deviceId &&
                device.label === devices[index].label,
            )
              ? previous
              : devices,
          );
      } catch {
        // Labels/lens switching are optional; Webcam still owns the actual stream.
      }
    };
    void refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => {
      active = false;
      navigator.mediaDevices?.removeEventListener("devicechange", refresh);
    };
  }, [cameraReady]);

  useEffect(
    () => () => {
      captureController.current?.abort();
      if (shutterTimer.current) clearTimeout(shutterTimer.current);
    },
    [],
  );

  const videoConstraints = useMemo(
    () => ({
      width: { ideal: previewAspectRatio < 1 ? 1440 : 1920 },
      height: { ideal: previewAspectRatio < 1 ? 1920 : 1080 },
      aspectRatio: { ideal: previewAspectRatio },
      ...(selectedDevice
        ? { deviceId: { exact: selectedDevice } }
        : activeDeviceIndex !== null &&
            relevantCameras[activeDeviceIndex]?.deviceId
          ? { deviceId: { exact: relevantCameras[activeDeviceIndex].deviceId } }
          : { facingMode: { ideal: facingMode } }),
    }),
    [
      previewAspectRatio,
      facingMode,
      relevantCameras,
      activeDeviceIndex,
      selectedDevice,
    ],
  );

  const cancelCapture = () => {
    captureController.current?.abort();
    captureController.current = null;
    setIsCapturing(false);
    setCountdown(0);
  };
  useEffect(() => {
    captureController.current?.abort();
    captureController.current = null;
    setIsCapturing(false);
    setCountdown(0);
  }, [captureIndex]);
  const switchCamera = () => {
    cancelCapture();
    setCameraReady(false);
    setActiveDeviceIndex(null);
    setSelectedDevice("");
    setActualFacing("");
    setMirrorOverride(null);
    setFacingMode((mode) => (mode === "user" ? "environment" : "user"));
  };
  const cycleNextCamera = () => {
    if (relevantCameras.length > 1) {
      cancelCapture();
      setCameraReady(false);
      setSelectedDevice("");
      const currentId = webcamRef.current?.stream
        ?.getVideoTracks()[0]
        ?.getSettings().deviceId;
      const currentIndex = relevantCameras.findIndex(
        (device) => device.deviceId === currentId,
      );
      setActiveDeviceIndex(
        (Math.max(0, currentIndex) + 1) % relevantCameras.length,
      );
    }
  };
  const handleCapture = async () => {
    const index =
      captureIndex ?? capturedImages.findIndex((image) => image === null);
    if (disabled || captureController.current || index < 0 || !cameraReady)
      return;
    const controller = new AbortController();
    captureController.current = controller;
    setIsCapturing(true);
    setCaptureError(null);
    try {
      for (let remaining = timer; remaining > 0; remaining--) {
        controller.signal.throwIfAborted();
        setCountdown(remaining);
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timeout);
            reject(new DOMException("Capture canceled", "AbortError"));
          };
          const timeout = setTimeout(() => {
            controller.signal.removeEventListener("abort", onAbort);
            resolve();
          }, 1000);
          controller.signal.addEventListener("abort", onAbort, { once: true });
        });
      }
      controller.signal.throwIfAborted();
      setCountdown(0);
      const video = webcamRef.current?.video;
      if (!video) throw new Error("The camera is not ready yet.");
      setShutterOn(true);
      if (shutterTimer.current) clearTimeout(shutterTimer.current);
      shutterTimer.current = setTimeout(() => setShutterOn(false), 110);
      const box = viewportRef.current?.getBoundingClientRect();
      const visibleRatio =
        box && box.height > 0 ? box.width / box.height : previewAspectRatio;
      const blob = await captureVideo(video, mirrored, filter, visibleRatio);
      if (!controller.signal.aborted) await onPhotoChange(index, blob);
    } catch (error) {
      if (!controller.signal.aborted)
        setCaptureError(
          error instanceof Error
            ? error.message
            : "We couldn’t take that photo. Please try again.",
        );
    } finally {
      if (captureController.current === controller) {
        captureController.current = null;
        setIsCapturing(false);
        setCountdown(0);
      }
    }
  };
  const handleReset = () => {
    cancelCapture();
    if (
      facingMode !== "user" ||
      isWidescreen ||
      activeDeviceIndex !== null ||
      selectedDevice
    )
      setCameraReady(false);
    onReset();
    setFacingMode("user");
    setActiveDeviceIndex(null);
    setSelectedDevice("");
    setActualFacing("");
    setTimer(0);
    setFilter("normal");
    setMirrorOverride(null);
    setIsWidescreen(false);
  };
  const handleDeletePhoto = (index: number) => {
    cancelCapture();
    onPhotoChange(index, null);
  };

  return (
    <div className={focused ? "camera-focus-mode" : undefined}>
      {showRoll && (
        <div className="panel-heading">
          <span className="panel-kicker">A GOOD DAY TO MAKE A MEMORY</span>
          <h2>Find your light. Be yourself.</h2>
          <p>
            A favourite filter, a little countdown, and your best wonderfully
            imperfect pose.
          </p>
        </div>
      )}
      {captureError && (
        <p className="notice-error" role="alert">
          {captureError}
        </p>
      )}
      <div
        className={`camera-workspace ${showRoll ? "" : "camera-workspace-single"}`}
      >
        <div className="camera-column">
          <div className="camera-toolbar">
            <div className="camera-tools">
              <button
                type="button"
                className="camera-tool"
                disabled={disabled || isCapturing}
                aria-label="Mirror camera"
                aria-pressed={mirrored}
                title="Mirror preview and captured photo"
                onClick={() => setMirrorOverride(!mirrored)}
              >
                <FiRepeat /> <span>Mirror</span>
              </button>
              <button
                ref={focusButtonRef}
                type="button"
                className="camera-tool"
                aria-label={focused ? "Exit camera focus" : "Focus camera"}
                aria-pressed={focused}
                onClick={() => setFocused(value => !value)}
              >
                {focused ? <FiMinimize2 /> : <FiMaximize2 />}
                <span>{focused ? "Exit focus" : "Focus"}</span>
              </button>
              <button
                type="button"
                className="camera-tool"
                disabled={disabled}
                onClick={switchCamera}
                aria-label="Switch camera"
                title="Switch camera"
              >
                <FiRepeat />
                <span>Flip</span>
              </button>
              {relevantCameras.length > 1 && (
                <button
                  type="button"
                  className="camera-tool"
                  disabled={disabled}
                  onClick={cycleNextCamera}
                  aria-label="Switch lens"
                >
                  <FiRefreshCw />
                  <span>Lens</span>
                </button>
              )}
              <button
                type="button"
                className="camera-tool"
                disabled={disabled}
                onClick={() => {
                  cancelCapture();
                  setIsWidescreen((wide) => !wide);
                }}
                aria-label={isWidescreen ? "Auto view" : "Wide view"}
                title={
                  isWidescreen
                    ? "Use the view for your screen"
                    : "Use a wider view"
                }
              >
                <FiMaximize2 />
                <span>{isWidescreen ? "Auto view" : "Wide view"}</span>
              </button>
            </div>
            <div className="timer-tools" aria-label="Photo timer">
              <FiClock aria-hidden="true" />
              {[0, 3, 5, 10].map((seconds) => (
                <button
                  key={seconds}
                  type="button"
                  aria-label={seconds === 0 ? "Timer off" : `${seconds}s`}
                  aria-pressed={timer === seconds}
                  disabled={disabled}
                  onClick={() => setTimer(seconds)}
                >
                  {seconds === 0 ? "Off" : `${seconds}s`}
                </button>
              ))}
            </div>
            <select
              className="landscape-filter-select"
              aria-label="Camera filter"
              value={filter}
              disabled={disabled}
              onChange={(event) => {
                const selected = cameraFilters.find(
                  (item) => item.value === event.target.value,
                );
                if (selected) setFilter(selected.value);
              }}
            >
              {cameraFilters.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {devices.filter((device) => device.kind === "videoinput").length >
            1 && (
            <label className="camera-device-choice">
              Camera / lens
              <select
                aria-label="Camera device"
                value={selectedDevice}
                disabled={disabled}
                onChange={(event) => {
                  cancelCapture();
                  setCameraReady(false);
                  setActualFacing("");
                  setSelectedDevice(event.target.value);
                }}
              >
                <option value="">
                  Automatic ({facingMode === "user" ? "front" : "back"})
                </option>
                {devices
                  .filter((device) => device.kind === "videoinput")
                  .map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${index + 1}`}
                    </option>
                  ))}
              </select>
              <small>
                Choose an available lens for wide-angle or close-up photos.
              </small>
            </label>
          )}
          <div
            ref={viewportRef}
            className="camera-viewport"
            data-view={
              isWidescreen ? "wide" : portrait ? "portrait" : "standard"
            }
            style={{ aspectRatio: previewAspectRatio }}
            aria-label="Camera preview"
          >
            <Webcam
              key={cameraAttempt}
              ref={webcamRef}
              audio={false}
              playsInline
              videoConstraints={videoConstraints}
              onLoadedData={() => {
                const track = webcamRef.current?.stream?.getVideoTracks()[0];
                const label = track?.label ?? "";
                const inferredFacing =
                  /back|rear|environment|ultra.?wide|telephoto/i.test(label)
                    ? "environment"
                    : /front|user|facetime/i.test(label)
                      ? "user"
                      : facingMode;
                setActualFacing(
                  track?.getSettings().facingMode || inferredFacing,
                );
                setCameraReady(true);
                setCameraError(null);
              }}
              onUserMediaError={() => {
                setCameraReady(false);
                cancelCapture();
                setCameraError(
                  "Check your camera permissions, or try uploading a photo instead.",
                );
              }}
              style={{
                filter: filterCss(filter),
                transform: mirrored ? "scaleX(-1)" : "none",
              }}
            />
            {!cameraReady && !cameraError && (
              <div className="camera-placeholder" role="status">
                <Flower />
                <p>
                  Finding your good side…
                  <br />
                  Allow camera access to get started.
                </p>
              </div>
            )}
            {cameraError && (
              <div className="camera-placeholder camera-error" role="alert">
                <FiCamera />
                <h3>Your camera needs a little help.</h3>
                <p>{cameraError}</p>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setCameraError(null);
                    setCameraAttempt((attempt) => attempt + 1);
                  }}
                >
                  Try again
                </button>
              </div>
            )}
            {cameraReady && (
              <>
                <span className="camera-status">
                  <span className="live-dot" />{" "}
                  {(actualFacing || facingMode) === "user" ? "Front camera" : "Back camera"}
                </span>
                {["tl", "tr", "bl", "br"].map((corner) => (
                  <span
                    key={corner}
                    className={`camera-corner corner-${corner}`}
                  />
                ))}
              </>
            )}
            <div className={`shutter-overlay ${shutterOn ? "is-on" : ""}`} />
            {isCapturing && countdown > 0 && (
              <div
                className="capture-countdown"
                role="status"
                aria-label={`Taking photo in ${countdown}`}
              >
                {countdown}
              </div>
            )}
          </div>
          <div className="capture-actions">
            <button
              type="button"
              className="reset-button"
              onClick={handleReset}
              disabled={disabled}
            >
              <FiRefreshCw /> {resetLabel}
            </button>
            <button
              type="button"
              className="capture-button"
              onClick={handleCapture}
              disabled={disabled || isComplete || isCapturing || !cameraReady}
              aria-label={
                captureLabel ?? `Capture (${capturedCount}/${totalSlots})`
              }
            >
              <FiCamera />
            </button>
            <p>
              {isComplete
                ? "Looking lovely!"
                : `${capturedCount} of ${totalSlots} moments`}
            </p>
            {isCapturing && countdown > 0 && (
              <button
                type="button"
                className="button button-secondary cancel-capture-button"
                onClick={cancelCapture}
              >
                Cancel timer
              </button>
            )}
          </div>
          <div className="camera-filters" aria-label="Camera filters">
            {cameraFilters.map((item, index) => (
              <button
                type="button"
                key={item.value}
                className="filter-option"
                aria-label={item.label}
                aria-pressed={filter === item.value}
                disabled={disabled}
                onClick={() => setFilter(item.value)}
              >
                <span style={{ filter: item.css }}>
                  <MiniScene variant={index % 3} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        {showRoll && (
          <aside className="camera-roll">
            <div className="camera-roll-header">
              <h3>Your moments</h3>
              <span>
                {capturedCount}/{totalSlots}
              </span>
            </div>
            <div
              className="photo-grid"
              style={{
                ...getGridStyle(layout),
                maxWidth: Math.max(
                  90,
                  Math.min(210, 380 * getLayoutAspect(layout)),
                ),
                marginInline: "auto",
              }}
            >
              {capturedImages.map((image, index) => (
                <div
                  key={index}
                  className="photo-cell"
                  style={getCellStyle(getCells(layout)[index])}
                >
                  {image ? (
                    <PhotoSlotImage
                      source={image}
                      alt={`Capture ${index + 1}`}
                      onDelete={() => handleDeletePhoto(index)}
                    />
                  ) : (
                    <span className="empty-capture">{index + 1}</span>
                  )}
                </div>
              ))}
            </div>
            <p>
              A little collection of you.
              <br />
              Not quite right? Remove it and try again.
            </p>
            {isComplete && (
              <button
                type="button"
                className="button button-primary"
                onClick={onCaptureComplete}
              >
                <FiCheck /> Make it yours <FiArrowRight />
              </button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
