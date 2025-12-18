'use client';

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react';
import { FaCamera, FaFileUpload, FaArrowLeft, FaPlus, FaTrash, FaEdit } from 'react-icons/fa';
import { layouts, LayoutInfo } from '@/lib/layout';
// Impor komponen preview yang sudah kita buat
import PhotostripPreview from './photostrip';

interface LayoutProps {
  setActiveTab: (tab: 'camera' | 'edit' | 'layout') => void;
}

export default function Layout({ setActiveTab }: LayoutProps) {
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 1. State Management Baru yang Mirip dengan Camera.tsx
  const [view, setView] = useState<'selecting_layout' | 'building_photostrip'>('selecting_layout');
  const [slottedImages, setSlottedImages] = useState<(string | null)[]>([]);
  const [uploadTargetIndex, setUploadTargetIndex] = useState<number | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);

  const selectedLayout = useMemo(
    () => layouts.find((l) => l.id === selectedLayoutId) || null,
    [selectedLayoutId]
  );

  // Efek untuk mereset state saat komponen dimuat atau tab berubah
  useEffect(() => {
    setView('selecting_layout');
    setSlottedImages([]);
    setSelectedLayoutId(null);
  }, []);

  // Menginisialisasi slot saat layout dipilih
  useEffect(() => {
    if (selectedLayout) {
      setSlottedImages(Array(selectedLayout.rows * selectedLayout.cols).fill(null));
    }
  }, [selectedLayout]);


  const handleApplyToCamera = () => {
  if (selectedLayoutId) { // Langsung cek ID-nya, yang kita tahu pasti ada
    localStorage.setItem('selectedLayout', selectedLayoutId);
    setActiveTab('camera');
  }
};

  // 2. Tombol Upload utama sekarang hanya mengganti tampilan
  const handleStartUploadProcess = () => {
    if (selectedLayout) {
      setView('building_photostrip');
    }
  };
  
  // 3. Handler untuk tombol '+' di setiap slot
  const handleAddPhotoClick = (index: number) => {
    setUploadTargetIndex(index); // Simpan index slot mana yang akan diisi
    fileInputRef.current?.click(); // Buka file picker
  };

  // 4. Logika File Select diubah untuk mengisi satu slot saja
  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || uploadTargetIndex === null) return;

    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onloadend = () => {
      const newImages = [...slottedImages];
      newImages[uploadTargetIndex] = reader.result as string;
      setSlottedImages(newImages);
      setUploadTargetIndex(null); // Reset target
    };

    reader.readAsDataURL(file);
    event.target.value = ''; 
  };
  
  // 5. Logika untuk menghapus foto (sama seperti di Camera.tsx)
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
    if (finalImages.length === 0) return; // Jangan lanjut jika tidak ada gambar

    localStorage.setItem('selectedLayout', selectedLayout.id);
    localStorage.setItem('uploadedImages', JSON.stringify(finalImages));
    setActiveTab('edit');
  };

  return (
    <div className="flex flex-col items-center space-y-8">
      {view === 'selecting_layout' && (
        <>
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-purple-800">Choose a Layout</h3>
            <p className="text-sm text-purple-500 mt-2">Pick a layout, then continue with your camera or upload photos.</p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-6 w-full max-w-4xl">
            {layouts.map((layout) => (
              <div
                key={layout.id}
                onClick={() => setSelectedLayoutId(layout.id)}
                className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 w-40 flex flex-col justify-center ${
                  selectedLayoutId === layout.id
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
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 w-full pt-4">
            <button onClick={handleApplyToCamera} disabled={!selectedLayoutId} className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold shadow-md transition disabled:bg-purple-300 disabled:cursor-not-allowed bg-purple-500 hover:bg-purple-600"><FaCamera /> Apply to Camera</button>
            <button onClick={handleStartUploadProcess} disabled={!selectedLayoutId} className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-purple-700 bg-purple-100 font-semibold shadow-md transition disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed border border-purple-300 hover:bg-purple-200"><FaFileUpload /> Upload & Edit</button>
          </div>
        </>
      )}

     {view === 'building_photostrip' && selectedLayout && (
        <>
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-purple-800">Arrange Your Photos</h3>
            <p className="text-sm text-purple-500 mt-2">Click on a slot to add a photo.</p>
          </div>

          {/* 6. Grid Interaktif Baru */}
          <div 
            className="w-full max-w-md p-2 bg-gray-100 rounded-lg"
            style={{ aspectRatio: `${selectedLayout.cols} / ${selectedLayout.rows}` }}
          >
            <div className="grid h-full w-full gap-2" style={{ gridTemplateColumns: `repeat(${selectedLayout.cols}, 1fr)`, gridTemplateRows: `repeat(${selectedLayout.rows}, 1fr)` }}>
              {slottedImages.map((image, i) => (
                <div 
                  key={i} 
                  onClick={() => image && handleSelectPhotoForDeletion(i)}
                  className="bg-gray-300 rounded-md overflow-hidden flex justify-center items-center relative cursor-pointer"
                >
                  {image ? (
                    <>
                      <img src={image} className={`w-full h-full object-cover transition-all duration-300 ${photoToDelete === i ? 'brightness-50' : ''}`} alt={`Uploaded ${i + 1}`} />
                      <div className={`absolute inset-0 flex justify-center items-center transition-opacity duration-300 ${photoToDelete === i ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeletePhoto(i); }} 
                          className="text-white text-4xl p-3 bg-black/40 rounded-full hover:bg-red-500/80 transform hover:scale-110 transition-all duration-200"
                          aria-label="Delete photo"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => handleAddPhotoClick(i)} className="w-full h-full flex items-center justify-center bg-purple-50 hover:bg-purple-100 transition-colors">
                      <FaPlus className="text-purple-400 text-3xl" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>       
           <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 w-full pt-4">
            <button
              onClick={() => setView('selecting_layout')}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-gray-700 bg-gray-200 font-semibold shadow-md transition hover:bg-gray-300"
            >
              <FaArrowLeft /> Back
            </button>
            <button
              onClick={handleConfirmAndEdit}
              disabled={slottedImages.every(img => img === null)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-lg text-white font-semibold shadow-md transition disabled:bg-purple-300 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700"
            >
              <FaEdit /> Continue to Edit
            </button>
          </div>
        </>
      )}

      {/* Input file sekarang TIDAK multiple */}
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
    </div>
  );
}