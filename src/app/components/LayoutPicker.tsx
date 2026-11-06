"use client";

import { useState, useRef, type ChangeEvent, useEffect } from "react";
import {
  FiArrowLeft,
  FiArrowRight,
  FiCamera,
  FiCheckCircle,
  FiImage,
  FiPlus,
  FiRefreshCw,
  FiUpload,
} from "react-icons/fi";
import {
  layouts,
  DEFAULT_LAYOUT,
  getSlotCount,
  getCells,
  getCellStyle,
  getGridStyle,
  getLayoutAspect,
  type LayoutCategory,
  type LayoutInfo,
} from "@/lib/layout";
import type { PhotoSlots, PhotoboothTab } from "@/lib/photobooth-session";
import { prepareUpload } from "@/lib/images";
import PhotoSlotImage from "./PhotoSlotImage";
import { MiniScene } from "./MemoryArt";

interface LayoutProps {
  selectedLayout: LayoutInfo | null;
  images: PhotoSlots;
  onSelectLayout: (layout: LayoutInfo) => void;
  onPhotoChange: (index: number, blob: Blob | null) => void;
  setActiveTab: (tab: PhotoboothTab) => void;
}

export default function Layout({
  selectedLayout,
  images,
  onSelectLayout,
  onPhotoChange,
  setActiveTab,
}: LayoutProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadController = useRef<AbortController | null>(null);
  const uploadTargetIndex = useRef<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [category, setCategory] = useState<LayoutCategory | "All">("All");
  const visibleLayouts = layouts.filter(
    (layout) => category === "All" || layout.category === category,
  );
  const shownLayout = selectedLayout ?? DEFAULT_LAYOUT;
  const count = images.filter(Boolean).length;

  useEffect(() => () => uploadController.current?.abort(), []);

  const handleAddPhoto = (index: number) => {
    if (isUploading) return;
    uploadTargetIndex.current = index;
    fileInputRef.current?.click();
  };
  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    const index = uploadTargetIndex.current;
    event.currentTarget.value = "";
    if (!file || index === null) return;
    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    setIsUploading(true);
    setError(null);
    try {
      const blob = await prepareUpload(file, controller.signal);
      if (!controller.signal.aborted) onPhotoChange(index, blob);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "We couldn’t open that photo. Try another one.",
        );
    } finally {
      if (!controller.signal.aborted) {
        setIsUploading(false);
        uploadTargetIndex.current = null;
      }
    }
  };

  return (
    <div>
      <div className="panel-heading">
        <span className="panel-kicker">
          {building
            ? "A FEW OF YOUR FAVOURITES"
            : "EVERY MEMORY NEEDS A LITTLE FRAME"}
        </span>
        <h2>
          {building ? "Bring your photos along." : "Find your favourite shape."}
        </h2>
        <p>
          {building
            ? "Tap an empty space to add a photo. Leave a few empty if you like."
            : "Long strips, little squares, or a bit of both. Pick the one that feels like you."}
        </p>
      </div>
      {error && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      {!building ? (
        <div className="layout-workspace">
          <div>
            <div className="catalog-categories" aria-label="Layout categories">
              {(
                ["All", "Strips", "Grids", "Portrait", "Creative"] as const
              ).map((name) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={category === name}
                  onClick={() => setCategory(name)}
                >
                  {name}
                  {name === "All" && <small>{layouts.length}</small>}
                </button>
              ))}
            </div>
            <div className="layout-options" aria-label="Choose a layout">
              {visibleLayouts.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  className="layout-option"
                  aria-pressed={selectedLayout?.id === layout.id}
                  aria-label={`${layout.label} layout`}
                  onClick={() => onSelectLayout(layout)}
                >
                  {selectedLayout?.id === layout.id && (
                    <FiCheckCircle className="layout-check" />
                  )}
                  <span className="layout-mini" aria-hidden="true">
                    <div
                      style={{
                        ...getGridStyle(layout),
                        width: Math.min(62, 65 * getLayoutAspect(layout)),
                      }}
                    >
                      {getCells(layout).map((cell, index) => (
                        <span key={index} style={getCellStyle(cell)} />
                      ))}
                    </div>
                  </span>
                  <span className="layout-option-label">{layout.label}</span>
                  <small>
                    {getSlotCount(layout)}{" "}
                    {getSlotCount(layout) === 1 ? "photo" : "photos"}
                  </small>
                </button>
              ))}
            </div>
            <p className="layout-helper">
              <FiRefreshCw /> Changing layout clears photos. Your styling stays.
            </p>
          </div>
          <aside className="layout-summary">
            <div className="summary-label">
              <span>A little preview</span>
              <span className="small-badge">
                {selectedLayout ? selectedLayout.label : "Your memory here"}
              </span>
            </div>
            <div className="layout-demo-board">
              <div
                className="layout-demo-strip"
                style={{
                  ...getGridStyle(shownLayout),
                  width: Math.max(
                    58,
                    Math.min(175, 175 * getLayoutAspect(shownLayout)),
                  ),
                }}
              >
                {getCells(shownLayout).map((cell, index) => (
                  <div key={index} style={getCellStyle(cell)}>
                    <MiniScene variant={index} />
                  </div>
                ))}
              </div>
            </div>
            <h3>
              {selectedLayout
                ? "Ready for your close-up?"
                : "A shape for every little moment."}
            </h3>
            <p>
              {selectedLayout
                ? "Use your camera or choose photos you already love."
                : "Pick a layout, then let’s fill it with something lovely."}
            </p>
            <div className="summary-actions">
              <button
                type="button"
                className="button button-primary"
                disabled={!selectedLayout}
                onClick={() => setActiveTab("camera")}
              >
                <FiCamera /> Use camera <FiArrowRight />
              </button>
              <button
                type="button"
                className="button button-secondary"
                disabled={!selectedLayout}
                onClick={() => setBuilding(true)}
              >
                <FiUpload /> Upload photos
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <div className="upload-workspace">
          <div className="upload-grid-wrap">
            <div
              className="photo-grid"
              style={{
                maxWidth: Math.max(
                  110,
                  Math.min(370, 420 * getLayoutAspect(shownLayout)),
                ),
                ...getGridStyle(shownLayout),
              }}
            >
              {images.map((image, index) => (
                <div
                  key={index}
                  className="photo-cell"
                  data-upload-slot={index}
                  style={getCellStyle(getCells(shownLayout)[index])}
                >
                  {image ? (
                    <PhotoSlotImage
                      source={image}
                      alt={`Uploaded ${index + 1}`}
                      onDelete={() => onPhotoChange(index, null)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="add-photo"
                      aria-label={`Add photo ${index + 1}`}
                      disabled={isUploading}
                      onClick={() => handleAddPhoto(index)}
                    >
                      <FiPlus />
                      <span>
                        {isUploading && uploadTargetIndex.current === index
                          ? "Opening…"
                          : index + 1}
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <aside className="upload-instructions">
            <span className="feature-icon">
              <FiImage />
            </span>
            <h3 style={{ marginTop: 18 }}>
              A few favourites.
              <br />
              One lovely memory.
            </h3>
            <p>
              Add your photos one at a time. Tap the little bin to remove one
              and try something else.
            </p>
            <div className="upload-progress">
              <span className="progress-dots">
                {images.map((image, index) => (
                  <span key={index} className={image ? "filled" : ""} />
                ))}
              </span>
              <span role="status">
                {isUploading
                  ? "Opening your photo…"
                  : `${count} of ${images.length} photos added`}
              </span>
            </div>
            <button
              type="button"
              className="button button-primary"
              disabled={isUploading || !count}
              onClick={() => setActiveTab("edit")}
            >
              Make it yours <FiArrowRight />
            </button>
            <button
              type="button"
              className="text-link"
              disabled={isUploading}
              onClick={() => setBuilding(false)}
            >
              <FiArrowLeft /> Back to layouts
            </button>
          </aside>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        disabled={isUploading}
        accept="image/*"
        aria-label="Upload photo"
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
