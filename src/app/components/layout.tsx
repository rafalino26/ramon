// app/components/layout.tsx

'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { FaCamera, FaFileUpload } from 'react-icons/fa';
// 1. Impor data layout dari file terpusat
import { layouts, LayoutInfo } from '@/lib/layout';

interface LayoutProps {
  setActiveTab: (tab: 'camera' | 'edit' | 'layout') => void;
}

export default function Layout({ setActiveTab }: LayoutProps) {
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Array layouts lokal sudah dihapus, karena kita sudah impor dari file lain.
  // Kode lainnya tidak ada yang berubah.

  const handleApplyToCamera = () => {
    if (selectedLayout) {
      localStorage.setItem('selectedLayout', selectedLayout);
      setActiveTab('camera');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !selectedLayout) return;
    const files = Array.from(event.target.files);
    const imagePromises = files.map(file => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(imagePromises).then(base64Images => {
      localStorage.setItem('selectedLayout', selectedLayout);
      localStorage.setItem('uploadedImages', JSON.stringify(base64Images));
      event.target.value = ''; 
      setActiveTab('edit');
    });
  };

  return (
    <div className="flex flex-col items-center space-y-8">
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-purple-800">Choose a Layout</h3>
        <p className="text-sm text-purple-500 mt-2">Pick a layout, then continue with your camera or upload photos.</p>
      </div>

      <div className="flex flex-wrap justify-center items-center gap-6 w-full max-w-4xl">
        {layouts.map((layout) => (
          <div
            key={layout.id}
            onClick={() => setSelectedLayout(layout.id)}
            className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 w-40 flex flex-col justify-center ${
              selectedLayout === layout.id
                ? 'border-purple-600 bg-purple-100 scale-105'
                : 'border-purple-200 hover:bg-purple-50'
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
              {Array.from({ length: layout.rows * layout.cols }).map((_, i) => (
                <div key={i} className="bg-purple-300 rounded-sm" />
              ))}
            </div>
            <p className="text-center text-sm mt-2 text-purple-700 font-medium">{layout.label}</p>
          </div>
        ))}
      </div>

      <input
        type="file" ref={fileInputRef} onChange={handleFileSelect}
        multiple accept="image/*" className="hidden"
      />

      <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 w-full pt-4">
        <button
          onClick={handleApplyToCamera} disabled={!selectedLayout}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold shadow-md transition disabled:bg-purple-300 disabled:cursor-not-allowed bg-purple-500 hover:bg-purple-600"
        >
          <FaCamera /> Apply to Camera
        </button>
        <button
          onClick={handleUploadClick} disabled={!selectedLayout}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-purple-700 bg-purple-100 font-semibold shadow-md transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed border border-purple-300 hover:bg-purple-200"
        >
          <FaFileUpload /> Upload & Edit
        </button>
      </div>
    </div>
  );
}