"use client";

import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import type {
  EditorDesign,
  FramePattern,
  PhotoShape,
} from "@/lib/editor-design";
import { captionFont } from "@/lib/editor-design";
import { photoFilters, effectsCss, defaultEffects } from "@/lib/photo-filters";
import { patternSvg, svgUrl } from "@/lib/frame-art";
import { MiniScene } from "../MemoryArt";
import RangeField from "./RangeField";

export interface PanelProps {
  design: EditorDesign;
  onChange: (patch: Partial<EditorDesign>) => void;
  onBegin: () => void;
  onEnd: () => void;
}
export const frames = [
  { value: "thin", label: "Thin" },
  { value: "rounded", label: "Rounded" },
  { value: "polaroid", label: "Polaroid" },
  { value: "circle", label: "Circle" },
  { value: "film", label: "Film" },
  { value: "postcard", label: "Postcard" },
  { value: "double", label: "Double" },
  { value: "inset", label: "Inset" },
] as const;
const colors = [
  ["Paper white", "#ffffff"],
  ["Soft lilac", "#e5d4f5"],
  ["Petal pink", "#f5d9e3"],
  ["Butter yellow", "#f8edc5"],
  ["Sage green", "#dce8da"],
  ["Plum", "#59416d"],
  ["Blush", "#efbdca"],
  ["Lavender", "#bc9ae4"],
  ["Sky blue", "#c9e2f6"],
  ["Peach", "#f8d6bf"],
  ["Mint", "#c9e8de"],
  ["Lilac cream", "#f6effe"],
  ["Rose", "#bf6c8a"],
  ["Grape", "#8a58b2"],
  ["Periwinkle", "#9ba8dc"],
  ["Honey", "#e6bd65"],
  ["Forest", "#5c8a73"],
  ["Cocoa", "#906e64"],
  ["Cream", "#fff7e4"],
  ["Ice", "#e7f4fa"],
  ["Cherry", "#b64e67"],
  ["Midnight", "#30253f"],
  ["Cloud", "#edf0f4"],
  ["Warm paper", "#e9dfcc"],
] as const;
export function FramePanel({ design, onChange, onBegin, onEnd }: PanelProps) {
  return (
    <section>
      <h3>Choose a frame</h3>
      <div className="frame-options expanded-frames">
        {frames.map((frame) => (
          <button
            type="button"
            key={frame.value}
            className="frame-option"
            aria-pressed={design.frame === frame.value}
            onClick={() =>
              onChange({
                frame: frame.value,
                ...(frame.value === "film" ? { borderColor: "#30253f" } : {}),
              })
            }
          >
            <span
              className={`frame-shape shape-${frame.value}`}
              aria-hidden="true"
            >
              <span />
            </span>
            <span>{frame.label}</span>
          </button>
        ))}
      </div>
      <div className="range-pair">
        <RangeField
          label="Border width"
          value={design.padding}
          min={4}
          max={32}
          suffix="px"
          onChange={(padding) => onChange({ padding })}
          onBegin={onBegin}
          onEnd={onEnd}
        />
        <RangeField
          label="Photo gap"
          value={design.gap}
          min={0}
          max={20}
          suffix="px"
          onChange={(gap) => onChange({ gap })}
          onBegin={onBegin}
          onEnd={onEnd}
        />
      </div>
      <h3 className="subsection-title">Photo corners</h3>
      <div className="choice-row">
        {(["square", "rounded", "circle"] as PhotoShape[]).map((shape) => (
          <button
            type="button"
            key={shape}
            aria-label={`${shape} photo shape`}
            aria-pressed={design.photoShape === shape}
            onClick={() => onChange({ photoShape: shape })}
          >
            {shape}
          </button>
        ))}
      </div>
    </section>
  );
}
export function ColorPanel({ design, onChange }: PanelProps) {
  const [hex, setHex] = useState(design.borderColor.slice(1));
  useEffect(() => setHex(design.borderColor.slice(1)), [design.borderColor]);
  return (
    <section>
      <h3>A colour to match your mood</h3>
      <div className="color-options">
        {colors.map(([name, color]) => (
          <button
            type="button"
            key={color}
            className="color-swatch"
            aria-label={name}
            title={name}
            aria-pressed={design.borderColor === color}
            style={{ backgroundColor: color }}
            onClick={() => onChange({ borderColor: color })}
          >
            {design.borderColor === color && (
              <FiCheck
                style={{
                  color: ["#59416d", "#30253f", "#b64e67", "#8a58b2"].includes(
                    color,
                  )
                    ? "white"
                    : undefined,
                }}
              />
            )}
          </button>
        ))}
      </div>
      <div className="custom-color-row">
        <input
          type="color"
          className="native-color"
          aria-label="Choose a custom color"
          value={design.borderColor}
          onChange={(event) => onChange({ borderColor: event.target.value })}
        />
        <div className="hex-field">
          <label htmlFor="frame-hex">Hex</label>
          <div>
            <span aria-hidden="true">#</span>
            <input
              id="frame-hex"
              value={hex}
              maxLength={7}
              spellCheck={false}
              onChange={(event) => {
                const value = event.target.value.replace(/^#/, "");
                setHex(value);
                if (/^[0-9a-f]{6}$/i.test(value))
                  onChange({ borderColor: `#${value.toLowerCase()}` });
              }}
              onBlur={() => setHex(design.borderColor.slice(1))}
            />
          </div>
        </div>
      </div>
      <div className="tool-section-title subsection-title">
        <h3>Dress up the background</h3>
        <label className="pattern-color-label">
          Ink
          <input
            type="color"
            aria-label="Pattern color"
            value={design.patternColor}
            onChange={(event) => onChange({ patternColor: event.target.value })}
          />
        </label>
      </div>
      <div className="pattern-options">
        {(
          [
            "none",
            "dots",
            "hearts",
            "stars",
            "stripes",
            "checker",
            "grid",
          ] as FramePattern[]
        ).map((pattern) => {
          const svg = patternSvg(pattern, design.patternColor);
          return (
            <button
              key={pattern}
              type="button"
              aria-pressed={design.pattern === pattern}
              onClick={() => onChange({ pattern })}
            >
              <span
                style={{
                  backgroundColor: design.borderColor,
                  backgroundImage: svg ? `url("${svgUrl(svg)}")` : undefined,
                }}
              />
              <span>{pattern}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
export function FilterPanel({ design, onChange, onBegin, onEnd }: PanelProps) {
  const change = (patch: Partial<EditorDesign["effects"]>) =>
    onChange({ effects: { ...design.effects, ...patch } });
  return (
    <section>
      <div className="tool-section-title">
        <h3>Find your photo’s mood</h3>
        <button
          type="button"
          className="text-link"
          onClick={() => onChange({ effects: defaultEffects() })}
        >
          Reset look
        </button>
      </div>
      <div className="editor-filter-options">
        {photoFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={design.effects.preset === filter.id}
            onClick={() => change({ preset: filter.id })}
          >
            <span
              style={{
                filter: effectsCss({ ...defaultEffects(), preset: filter.id }),
              }}
            >
              <MiniScene />
            </span>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>
      <RangeField
        label="Filter intensity"
        value={design.effects.intensity}
        min={0}
        max={100}
        suffix="%"
        onChange={(intensity) => change({ intensity })}
        onBegin={onBegin}
        onEnd={onEnd}
      />
      <RangeField
        label="Brightness"
        value={design.effects.brightness}
        min={50}
        max={150}
        suffix="%"
        onChange={(brightness) => change({ brightness })}
        onBegin={onBegin}
        onEnd={onEnd}
      />
      <RangeField
        label="Contrast"
        value={design.effects.contrast}
        min={50}
        max={150}
        suffix="%"
        onChange={(contrast) => change({ contrast })}
        onBegin={onBegin}
        onEnd={onEnd}
      />
      <RangeField
        label="Saturation"
        value={design.effects.saturation}
        min={0}
        max={200}
        suffix="%"
        onChange={(saturation) => change({ saturation })}
        onBegin={onBegin}
        onEnd={onEnd}
      />
    </section>
  );
}
export function TextPanel({ design, onChange, onBegin, onEnd }: PanelProps) {
  const update = (patch: Partial<EditorDesign["caption"]>) =>
    onChange({ caption: { ...design.caption, ...patch } });
  return (
    <section>
      <h3>A few words to remember</h3>
      <div className="quick-captions" aria-label="Quick captions">
        {["Our little moment", "Better together", "A day to remember"].map(text => (
          <button type="button" key={text} onClick={() => update({ text })}>
            {text}
          </button>
        ))}
        <button type="button" onClick={() => update({
          text: new Intl.DateTimeFormat(undefined, {
            day: "numeric", month: "short", year: "numeric",
          }).format(new Date()),
        })}>
          Today’s date
        </button>
      </div>
      <label className="caption-field">
        Caption
        <input
          aria-label="Caption"
          type="text"
          value={design.caption.text}
          maxLength={48}
          placeholder="a little moment with you ♡"
          onFocus={onBegin}
          onBlur={onEnd}
          onChange={(event) => update({ text: event.target.value })}
        />
        <small>{design.caption.text.length}/48 characters</small>
      </label>
      <h3 className="subsection-title">Make it sound like you</h3>
      <div className="choice-row">
        {(["sans", "playful", "serif"] as const).map((font) => (
          <button
            type="button"
            key={font}
            aria-label={`${font} caption font`}
            aria-pressed={design.caption.font === font}
            style={{ fontFamily: captionFont(font) }}
            onClick={() => update({ font })}
          >
            {font === "sans"
              ? "Simple"
              : font === "playful"
                ? "Playful"
                : "Classic"}
          </button>
        ))}
      </div>
      <RangeField
        label="Caption size"
        min={10}
        max={26}
        value={design.caption.size}
        suffix="px"
        onChange={(size) => update({ size })}
        onBegin={onBegin}
        onEnd={onEnd}
      />
      <label className="pattern-color-label">
        Caption colour
        <input
          type="color"
          aria-label="Caption color"
          value={design.caption.color}
          onChange={(event) => update({ color: event.target.value })}
        />
      </label>
      <p className="editor-hint">
        The caption sits inside your frame and is included in your download.
      </p>
    </section>
  );
}
