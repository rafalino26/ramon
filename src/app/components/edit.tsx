// app/components/edit.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { SketchPicker, ColorResult } from "react-color";
import { toBlob } from "html-to-image";
import { FaBorderAll, FaPalette, FaDownload, FaImages } from "react-icons/fa";
import { FaArrowLeft, FaPlus, FaTrash, FaEdit } from "react-icons/fa"; // (kalau kamu butuh di UI lain, aman dihapus)
import { layoutMap, LayoutInfo } from "@/lib/layout";
import PhotostripPreview from "./photostrip";

interface EditProps {
  images: string[];
}

export default function Edit({ images }: EditProps) {
  const [layout, setLayout] = useState<LayoutInfo>({
    id: "default",
    label: "Default",
    rows: 1,
    cols: 1,
  });

  const [activePanel, setActivePanel] = useState<"border" | "color">("border");
  const [borderColor, setBorderColor] = useState("#ffffff");

  // default state include padding
  const [frameStyle, setFrameStyle] = useState("rounded-lg p-4");
  const [clipPathStyle, setClipPathStyle] = useState("");

  const photostripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLayoutId = localStorage.getItem("selectedLayout");
    if (savedLayoutId && layoutMap[savedLayoutId as keyof typeof layoutMap]) {
      setLayout(layoutMap[savedLayoutId as keyof typeof layoutMap]);
    }
  }, []);

  const isIOS = () => {
    if (typeof window === "undefined") return false;
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream
    );
  };

  const handleDownload = async (format: "png" | "jpeg") => {
    if (!photostripRef.current) return;

    const ext = format === "jpeg" ? "jpg" : "png";
    const filename = `ramon-photobooth.${ext}`;

    try {
      const blob = await toBlob(photostripRef.current, {
        cacheBust: true,
        backgroundColor: borderColor,
        ...(format === "jpeg" ? { quality: 0.9 } : {}),
      });

      if (!blob) throw new Error("Failed to create blob");

      // iOS: prefer Share Sheet (Save Image)
      if (isIOS() && "share" in navigator) {
        const file = new File([blob], filename, { type: blob.type });

        const canShareFiles =
          (navigator as any).canShare?.({ files: [file] }) ?? true;

        if (canShareFiles) {
          await (navigator as any).share({
            files: [file],
            title: "Ramon Photobooth",
          });
          return;
        }
      }

      // Default download (Android/Windows/Desktop)
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);

      // Fallback Safari-friendly: open image in new tab (user can long-press Save Image)
      try {
        const blob = await toBlob(photostripRef.current!, {
          cacheBust: true,
          backgroundColor: borderColor,
          ...(format === "jpeg" ? { quality: 0.9 } : {}),
        });
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        console.error("Fallback error:", e);
      }
    }
  };

  const handleFrameStyleChange = (style: string) => {
    setFrameStyle(style);
    setClipPathStyle(""); // reset clip-path if normal frame style chosen
  };

  const handleClipPathChange = (clipPath: string) => {
    setFrameStyle(""); // remove normal frame style
    setClipPathStyle(clipPath);
  };

  const handleColorChange = (color: ColorResult) => {
    setBorderColor(color.hex);
  };

  if (images.length === 0) {
    return (
      <div className="text-center text-purple-500 p-8">
        <h3 className="text-xl font-semibold">No Images to Edit</h3>
        <p className="text-sm mt-2">Please go back to capture or upload photos.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* Left: Preview */}
      <div className="flex flex-col items-center gap-4">
        <PhotostripPreview
          ref={photostripRef}
          layout={layout}
          images={images}
          borderColor={borderColor}
          borderStyle={frameStyle}
          clipPathStyle={clipPathStyle}
        />
      </div>

      {/* Right: Controls */}
      <div className="w-full bg-purple-50 p-4 rounded-2xl flex-shrink-0 flex flex-col">
        {/* Tabs */}
        <div className="flex justify-around mb-4 border-b border-purple-200">
          {[
            { label: "Border", icon: <FaBorderAll />, panel: "border" },
            { label: "Color", icon: <FaPalette />, panel: "color" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => setActivePanel(item.panel as "border" | "color")}
              className={`p-3 text-2xl transition-colors ${
                activePanel === item.panel
                  ? "text-purple-700"
                  : "text-purple-300 hover:text-purple-500"
              }`}
              aria-label={item.label}
              type="button"
            >
              {item.icon}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-grow">
          {activePanel === "border" && (
            <div className="space-y-3 animate-fade-in">
              <h4 className="font-semibold text-purple-800">Frame Style</h4>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleFrameStyleChange("p-3")}
                  className="h-16 border-2 border-purple-300 bg-white flex items-center justify-center text-purple-400"
                >
                  Thin
                </button>

                <button
                  type="button"
                  onClick={() => handleFrameStyleChange("rounded-xl p-4")}
                  className="h-16 border-2 border-purple-300 bg-white rounded-xl flex items-center justify-center text-purple-400"
                >
                  Rounded
                </button>

                <button
                  type="button"
                  onClick={() => handleFrameStyleChange("rounded-md px-3 pt-3 pb-18")}
                  className="h-16 border-2 border-purple-300 bg-white rounded-md flex items-center justify-center text-purple-400"
                >
                  <FaImages className="mr-2" /> Polaroid
                </button>

                <button
                  type="button"
                  onClick={() => handleFrameStyleChange("rounded-full p-5")}
                  className="h-16 border-2 border-purple-300 bg-white rounded-full flex items-center justify-center text-purple-400"
                >
                  Circle
                </button>
              </div>

              {/* kalau kamu ada clip-path presets, taruh tombolnya di sini */}
              {/* contoh:
              <button onClick={() => handleClipPathChange('polygon(...)')}>Clip</button>
              */}
            </div>
          )}

          {activePanel === "color" && (
            <div className="space-y-4 animate-fade-in">
              <h4 className="font-semibold text-purple-800 mb-2">Border Color</h4>
              <SketchPicker
                color={borderColor}
                onChangeComplete={handleColorChange}
                width="100%"
              />
            </div>
          )}
        </div>

        {/* Download buttons */}
        <div className="mt-auto pt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handleDownload("png")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-lg hover:bg-purple-700 transition-transform hover:scale-105 text-sm"
          >
            <FaDownload /> PNG
          </button>

          <button
            type="button"
            onClick={() => handleDownload("jpeg")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white font-semibold rounded-lg shadow-lg hover:bg-violet-700 transition-transform hover:scale-105 text-sm"
          >
            <FaDownload /> JPG
          </button>
        </div>
      </div>
    </div>
  );
}
