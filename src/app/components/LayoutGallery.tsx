"use client";
import { useState, type ReactNode } from "react";
import { FiCheckCircle, FiRefreshCw } from "react-icons/fi";
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
import { MiniScene } from "./MemoryArt";

export default function LayoutGallery({
  selectedLayout,
  onSelectLayout,
  actions,
  description = "Use your camera or choose photos you already love.",
}: {
  selectedLayout: LayoutInfo | null;
  onSelectLayout: (layout: LayoutInfo) => void;
  actions: ReactNode;
  description?: string;
}) {
  const [category, setCategory] = useState<LayoutCategory | "All">("All");
  const visibleLayouts = layouts.filter(
    (layout) => category === "All" || layout.category === category,
  );
  const shownLayout = selectedLayout ?? DEFAULT_LAYOUT;
  return (
    <div className="layout-workspace">
      <div>
        <div className="catalog-categories" aria-label="Layout categories">
          {(["All", "Strips", "Grids", "Portrait", "Creative"] as const).map(
            (name) => (
              <button
                type="button"
                key={name}
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name}
                {name === "All" && <small>{layouts.length}</small>}
              </button>
            ),
          )}
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
            ? description
            : "Pick a layout, then let’s fill it with something lovely."}
        </p>
        {actions}
      </aside>
    </div>
  );
}
