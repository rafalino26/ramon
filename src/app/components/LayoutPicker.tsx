"use client";

import { useState, useRef, ChangeEvent, useEffect, useMemo } from "react";
import {
  FaCamera,
  FaFileUpload,
  FaArrowLeft,
  FaPlus,
  FaTrash,
  FaEdit,
} from "react-icons/fa";
import { layouts } from "@/lib/layout";
import heic2any from "heic2any";

interface LayoutProps {
  setActiveTab: (tab: "camera" | "edit" | "layout") => void;
}

export default function Layout({ setActiveTab }: LayoutProps) {
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<
    "selecting_layout" | "building_photostrip"
  >("selecting_layout");
  const [slottedImages, setSlottedImages] = useState<(string | null)[]>([]);
  const [uploadTargetIndex, setUploadTargetIndex] = useState<number | null>(
    null
  );
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);

  const selectedLayout = useMemo(
    () => layouts.find((l) => l.id === selectedLayoutId) || null,
    [selectedLayoutId]
  );

  useEffect(() => {
    setView("selecting_layout");
    setSlottedImages([]);
    setSelectedLayoutId(null);
  }, []);

  useEffect(() => {
    if (selectedLayout) {
      setSlottedImages(Array(selectedLayout.rows * selectedLayout.cols).fill(null));
    }
  }, [selectedLayout]);

  const handleApplyToCamera = () => {
    if (selectedLayoutId) {
      localStorage.setItem("selectedLayout", selectedLayoutId);
      setActiveTab("camera");
    }
  };

  const handleStartUploadProcess = () => {
    if (selectedLayout) setView("building_photostrip");
  };

  const handleAddPhotoClick = (index: number) => {
    setUploadTargetIndex(index);
    fileInputRef.current?.click();
  };

  // ✅ convert HEIC/HEIF -> JPEG, lalu jadi dataURL
  const fileToDataUrlSafe = async (file: File): Promise<string> => {
    let workingBlob: Blob = file;
    let outType = file.type;

    if (file.type === "image/heic" || file.type === "image/heif") {
      const converted = (await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.92,
      })) as Blob;

      workingBlob = converted;
      outType = "image/jpeg";
    }

    // bikin FileReader dari blob (bukan file) supaya universal
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(workingBlob);
    });

    // safety: kalau hasil dari heic2any masih tanpa prefix yang bener (jarang), bisa dipaksa
    if (outType === "image/jpeg" && !dataUrl.startsWith("data:image/jpeg")) {
      // tetep balikin dataUrl original karena biasanya sudah benar
      return dataUrl;
    }

    return dataUrl;
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    if (uploadTargetIndex === null) return;

    const file = event.target.files[0];

    try {
      const dataUrl = await fileToDataUrlSafe(file);

      // DEBUG cepat (boleh hapus nanti):
      console.log("upload type:", file.type);
      console.log("dataUrl prefix:", dataUrl.slice(0, 30));

      const newImages = [...slottedImages];
      newImages[uploadTargetIndex] = dataUrl;
      setSlottedImages(newImages);
      setUploadTargetIndex(null);
    } catch (e) {
      console.error("Upload/convert error:", e);
    }

    event.target.value = "";
  };

  const handleSelectPhotoForDeletion = (index: number) => {
    setPhotoToDelete(photoToDelete === index ? null : index);
  };

  const handleDeletePhoto = (indexToDelete: number) => {
    const newImages = [...slottedImages];
    newImages[indexToDelete] = null;
    setSlottedImages(newImages);
    setPhotoToDelete(null);
  };

  const handleConfirmAndEdit = () => {
    if (!selectedLayout) return;
    const finalImages = slottedImages.filter(Boolean) as string[];
    if (finalImages.length === 0) return;

    localStorage.setItem("selectedLayout", selectedLayout.id);
    localStorage.setItem("uploadedImages", JSON.stringify(finalImages));
    setActiveTab("edit");
  };

  return (
    <div className="flex flex-col items-center space-y-8">
      {view === "selecting_layout" && (
        <>
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-purple-800">
              Choose a Layout
            </h3>
            <p className="text-sm text-purple-500 mt-2">
              Pick a layout, then continue with your camera or upload photos.
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6 w-full max-w-4xl">
            {layouts.map((layout) => (
              <div
                key={layout.id}
                onClick={() => setSelectedLayoutId(layout.id)}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 w-40 flex flex-col justify-center ${
                  selectedLayoutId === layout.id
                    ? "border-purple-600 bg-purple-100 scale-105"
                    : "border-purple-200 hover:bg-purple-50"
                }`}
              >
                <div
                  className="grid gap-1 bg-white rounded-md p-1 shadow-inner"
                  style={{
                    gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                    gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                    aspectRatio: `${layout.cols} / ${layout.rows}`,
                  }}
                >
                  {Array.from({ length: layout.rows * layout.cols }).map(
                    (_, i) => (
                      <div key={i} className="bg-purple-300 rounded-sm" />
                    )
                  )}
                </div>
                <p className="text-center text-sm mt-2 text-purple-700 font-medium">
                  {layout.label}
                </p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 w-full pt-4">
            <button
              onClick={handleApplyToCamera}
              disabled={!selectedLayoutId}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold shadow-md transition disabled:bg-purple-300 disabled:cursor-not-allowed bg-purple-500 hover:bg-purple-600"
            >
              <FaCamera /> Apply to Camera
            </button>

            <button
              onClick={handleStartUploadProcess}
              disabled={!selectedLayoutId}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-purple-700 bg-purple-100 font-semibold shadow-md transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed border border-purple-300 hover:bg-purple-200"
            >
              <FaFileUpload /> Upload & Edit
            </button>
          </div>
        </>
      )}

      {view === "building_photostrip" && selectedLayout && (
        <>
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-purple-800">
              Arrange Your Photos
            </h3>
            <p className="text-sm text-purple-500 mt-2">
              Click on a slot to add a photo.
            </p>
          </div>

          <div
            className="w-full max-w-md p-2 bg-gray-100 rounded-lg"
            style={{
              aspectRatio: `${selectedLayout.cols} / ${selectedLayout.rows}`,
            }}
          >
            <div
              className="grid h-full w-full gap-2"
              style={{
                gridTemplateColumns: `repeat(${selectedLayout.cols}, 1fr)`,
                gridTemplateRows: `repeat(${selectedLayout.rows}, 1fr)`,
              }}
            >
              {slottedImages.map((image, i) => (
                <div
                  key={i}
                  onClick={() => image && handleSelectPhotoForDeletion(i)}
                  className="bg-gray-300 rounded-md overflow-hidden flex justify-center items-center relative cursor-pointer"
                >
                  {image ? (
                    <>
                      <img
                        src={image}
                        className={`w-full h-full object-cover transition-all duration-300 ${
                          photoToDelete === i ? "brightness-50" : ""
                        }`}
                        alt={`Uploaded ${i + 1}`}
                        loading="eager"
                        decoding="sync"
                      />
                      <div
                        className={`absolute inset-0 flex justify-center items-center transition-opacity duration-300 ${
                          photoToDelete === i
                            ? "opacity-100"
                            : "opacity-0 pointer-events-none"
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(i);
                          }}
                          className="text-white text-4xl p-3 bg-black/40 rounded-full hover:bg-red-500/80 transform hover:scale-110 transition-all duration-200"
                          aria-label="Delete photo"
                          type="button"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAddPhotoClick(i)}
                      className="w-full h-full flex items-center justify-center bg-purple-50 hover:bg-purple-100 transition-colors"
                      type="button"
                    >
                      <FaPlus className="text-purple-400 text-3xl" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 w-full pt-4">
            <button
              onClick={() => setView("selecting_layout")}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-gray-700 bg-gray-200 font-semibold shadow-md transition hover:bg-gray-300"
              type="button"
            >
              <FaArrowLeft /> Back
            </button>

            <button
              onClick={handleConfirmAndEdit}
              disabled={slottedImages.every((img) => img === null)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold shadow-md transition disabled:bg-purple-300 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700"
              type="button"
            >
              <FaEdit /> Continue to Edit
            </button>
          </div>
        </>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
}
