// app/photobooth/PhotoboothClient.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaCamera, FaLayerGroup, FaEdit } from "react-icons/fa";
import { FaArrowUp } from "react-icons/fa6";

import Camera from "@/app/components/camera";
import Layout from "@/app/components/LayoutPicker";
import Edit from "@/app/components/edit";

export default function PhotoboothClient() {
  const [activeTab, setActiveTab] = useState<"layout" | "camera" | "edit">(
    "layout"
  );

  const [imagesToEdit, setImagesToEdit] = useState<string[]>([]);

  const handleCaptureComplete = (capturedImages: string[]) => {
    setImagesToEdit(capturedImages);
    setActiveTab("edit");
  };

  // ---- Scroll-to-top (mobile only UI) ----
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // --------------------------------------

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 relative">
      <h2 className="text-4xl font-bold text-gradient-animated font-coiny mb-2">
        <Link href="/">Ramon</Link>
      </h2>
      <p className="text-lg text-gradient-animated font-coiny mb-8">
        Capture your moments in style
      </p>

      <div className="flex w-full max-w-4xl bg-[#edddfd] p-1 rounded-t-2xl shadow-lg">
        {[
          { label: "Layout", value: "layout", icon: <FaLayerGroup /> },
          { label: "Camera", value: "camera", icon: <FaCamera /> },
          { label: "Edit", value: "edit", icon: <FaEdit /> },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() =>
              setActiveTab(tab.value as "layout" | "camera" | "edit")
            }
            className={`flex items-center justify-center w-full py-2 space-x-2 rounded-lg ${
              activeTab === tab.value
                ? "bg-purple-200 text-black"
                : "text-gray-400"
            }`}
            type="button"
          >
            {tab.icon}
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-b-2xl shadow-lg w-full max-w-4xl">
        {activeTab === "layout" && <Layout setActiveTab={setActiveTab} />}
        {activeTab === "camera" && (
          <Camera onCaptureComplete={handleCaptureComplete} />
        )}
        {activeTab === "edit" && <Edit images={imagesToEdit} />}
      </div>

      {/* Floating Scroll-To-Top Button (MOBILE ONLY) */}
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Back to top"
        className={`
          md:hidden
          fixed right-4 bottom-4 z-50
          h-12 w-12 rounded-full
          bg-purple-600 text-white
          shadow-lg
          flex items-center justify-center
          transition-all duration-200
          ${
            showScrollTop
              ? "opacity-100 scale-100"
              : "opacity-0 scale-90 pointer-events-none"
          }
        `}
      >
        <FaArrowUp className="text-xl" />
      </button>
    </div>
  );
}
