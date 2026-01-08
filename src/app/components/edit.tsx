"use client";

import { useState, useEffect, useRef } from "react";
import { SketchPicker, ColorResult } from "react-color";
import { FaBorderAll, FaPalette, FaDownload, FaImages } from "react-icons/fa";
import { layoutMap, LayoutInfo } from "@/lib/layout";
import PhotostripPreview from "./photostrip";

interface EditProps {
  images: string[];
}

type FramePreset = "thin" | "rounded" | "polaroid" | "circle";

export default function Edit({ images }: EditProps) {
  const [layout, setLayout] = useState<LayoutInfo>({
    id: "default",
    label: "Default",
    rows: 1,
    cols: 1,
  });

  const [activePanel, setActivePanel] = useState<"border" | "color">("border");
  const [borderColor, setBorderColor] = useState("#ffffff");

  // preview style (untuk UI)
  const [frameStyle, setFrameStyle] = useState("rounded-lg p-4");
  const [clipPathStyle, setClipPathStyle] = useState("");

  // export preset (untuk canvas)
  const [framePreset, setFramePreset] = useState<FramePreset>("rounded");

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

  const handleFrameStyleChange = (style: string, preset: FramePreset) => {
    setFrameStyle(style);
    setFramePreset(preset);
    setClipPathStyle("");
  };

  const handleClipPathChange = (clipPath: string) => {
    setFrameStyle("");
    setClipPathStyle(clipPath);
  };

  const handleColorChange = (color: ColorResult) => {
    setBorderColor(color.hex);
  };

  const shareOrDownloadBlob = async (blob: Blob, filename: string) => {
    // iOS: Share Sheet (Save Image)
    if (isIOS() && "share" in navigator) {
      try {
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
      } catch (e) {
        console.error("iOS share failed:", e);
      }
    }

    // default download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // ✅ dataURL -> Blob -> ObjectURL -> Image (lebih stabil di iOS)
  const loadImageSafe = async (src: string) => {
    // Debug prefix biar kamu bisa cek di iOS console
    console.log("export src prefix:", src.slice(0, 30));

    const res = await fetch(src); // works for dataURL too
    const blob = await res.blob();

    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = "async";
      // img.crossOrigin = "anonymous"; // kalau suatu saat pakai remote url
      img.src = url;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
      });

      // decode (Safari kadang butuh)
      // @ts-ignore
      await img.decode?.().catch?.(() => {});

      return img;
    } finally {
      // jangan revoke terlalu cepat sebelum drawImage (kita revoke setelah selesai draw)
      // jadi revoke-nya dilakukan setelah draw, bukan di sini
    }
  };

  const getExportMetrics = (preset: FramePreset) => {
    // ✅ iOS: kecilkan canvas biar aman memory
    // desktop/android boleh besar
    const baseCell = isIOS() ? 420 : 640; // <--- penting
    const gap = isIOS() ? 60 : 60;

    let paddingTop = 56;
    let paddingSide = 56;
    let paddingBottom = 56;
    let radius = 0; // ✅ frame luar selalu kotak

    if (preset === "thin") {
      paddingTop = paddingSide = paddingBottom = 28;
      radius = 0;
    }
    if (preset === "rounded") {
      paddingTop = paddingSide = paddingBottom = 64;
      radius = 56;
    }
    if (preset === "polaroid") {
      paddingTop = 56;
      paddingSide = 56;
      paddingBottom = isIOS() ? 150 : 200;
      radius = 0;
    }
    if (preset === "circle") {
      paddingTop = paddingSide = paddingBottom = 64;
      radius = 9999;
    }

    const gridW = layout.cols * baseCell + (layout.cols - 1) * gap;
    const gridH = layout.rows * baseCell + (layout.rows - 1) * gap;

    const canvasW = gridW + paddingSide * 2;
    const canvasH = gridH + paddingTop + paddingBottom;

    return {
      cell: baseCell,
      gap,
      paddingTop,
      paddingSide,
      paddingBottom,
      radius,
      canvasW,
      canvasH,
    };
  };

  const roundRectPath = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const exportWithCanvas = async (format: "png" | "jpeg") => {
    const ext = format === "jpeg" ? "jpg" : "png";
    const filename = `ramon-photobooth.${ext}`;

    const m = getExportMetrics(framePreset);

    const canvas = document.createElement("canvas");
    canvas.width = m.canvasW;
    canvas.height = m.canvasH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    // background frame
    ctx.save();
    roundRectPath(ctx, 0, 0, m.canvasW, m.canvasH, m.radius);
    ctx.clip();
    ctx.fillStyle = borderColor;
    ctx.fillRect(0, 0, m.canvasW, m.canvasH);
    ctx.restore();

    // load images one by one (biar 1 error gak ngebunuh semuanya)
    const objectUrlsToRevoke: string[] = [];

    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const idx = r * layout.cols + c;
        const src = images[idx];
        if (!src) continue;

        const x = m.paddingSide + c * (m.cell + m.gap);
        const y = m.paddingTop + r * (m.cell + m.gap);

        try {
          // load via fetch->blob->objectURL
          const res = await fetch(src);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          objectUrlsToRevoke.push(url);

          const img = new Image();
          img.decoding = "async";
          img.src = url;

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Image load failed"));
          });

          // @ts-ignore
          await img.decode?.().catch?.(() => {});

          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;

          // object-fit: cover
          const scale = Math.max(m.cell / iw, m.cell / ih);
          const sw = m.cell / scale;
          const sh = m.cell / scale;
          const sx = (iw - sw) / 2;
          const sy = (ih - sh) / 2;

          const slotRadius = 0; // ✅ foto juga kotak

          ctx.save();
          if (slotRadius > 0) {
            roundRectPath(ctx, x, y, m.cell, m.cell, slotRadius);
            ctx.clip();
          }
          ctx.drawImage(img, sx, sy, sw, sh, x, y, m.cell, m.cell);
          ctx.restore();
        } catch (e) {
          console.error("draw slot failed idx:", idx, e);
          // draw placeholder (optional)
          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.08)";
          ctx.fillRect(x, y, m.cell, m.cell);
          ctx.restore();
        }
      }
    }

    // revoke all objectURLs after drawing
    objectUrlsToRevoke.forEach((u) => URL.revokeObjectURL(u));

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob(
        (b) => resolve(b),
        format === "jpeg" ? "image/jpeg" : "image/png",
        format === "jpeg" ? 0.92 : undefined
      );
    });

    if (!blob) throw new Error("Failed to create blob");
    await shareOrDownloadBlob(blob, filename);
  };

  const handleDownload = async (format: "png" | "jpeg") => {
    try {
      await exportWithCanvas(format);
    } catch (e) {
      console.error("Export failed:", e);
      // fallback: open blank canvas (minimal)
      try {
        const m = getExportMetrics(framePreset);
        const canvas = document.createElement("canvas");
        canvas.width = m.canvasW;
        canvas.height = m.canvasH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = borderColor;
        ctx.fillRect(0, 0, m.canvasW, m.canvasH);

        const dataUrl =
          format === "jpeg"
            ? canvas.toDataURL("image/jpeg", 0.92)
            : canvas.toDataURL("image/png");

        const win = window.open();
        if (win) {
          win.document.write(
            `<img src="${dataUrl}" style="max-width:100%;height:auto;" />`
          );
        }
      } catch {}
    }
  };

  if (images.length === 0) {
    return (
      <div className="text-center text-purple-500 p-8">
        <h3 className="text-xl font-semibold">No Images to Edit</h3>
        <p className="text-sm mt-2">
          Please go back to capture or upload photos.
        </p>
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
                  onClick={() => handleFrameStyleChange("p-3", "thin")}
                  className="h-16 border-2 border-purple-300 bg-white flex items-center justify-center text-purple-400"
                >
                  Thin
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleFrameStyleChange("rounded-xl p-4", "rounded")
                  }
                  className="h-16 border-2 border-purple-300 bg-white rounded-xl flex items-center justify-center text-purple-400"
                >
                  Rounded
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleFrameStyleChange("px-3 pt-3 pb-[82px]", "polaroid")
                  }
                  className="h-16 border-2 border-purple-300 bg-white rounded-md flex items-center justify-center text-purple-400"
                >
                  <FaImages className="mr-2" /> Polaroid
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleFrameStyleChange("rounded-full p-5", "circle")
                  }
                  className="h-16 border-2 border-purple-300 bg-white rounded-full flex items-center justify-center text-purple-400"
                >
                  Circle
                </button>
              </div>

              {/* optional clip-path */}
              {/* <button onClick={() => handleClipPathChange("polygon(...)")}>Clip</button> */}
            </div>
          )}

          {activePanel === "color" && (
            <div className="space-y-4 animate-fade-in">
              <h4 className="font-semibold text-purple-800 mb-2">
                Border Color
              </h4>
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
