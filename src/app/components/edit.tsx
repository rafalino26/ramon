// app/components/edit.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { SketchPicker, ColorResult } from 'react-color';
import { toPng, toJpeg } from 'html-to-image';
import { FaBorderAll, FaPalette, FaDownload, FaImages } from 'react-icons/fa';
import { layoutMap, LayoutInfo } from '@/lib/layout';
import PhotostripPreview from './photostrip';

interface EditProps {
  images: string[];
}

export default function Edit({ images }: EditProps) {
  const [layout, setLayout] = useState<LayoutInfo>({ id: 'default', label: 'Default', rows: 1, cols: 1 });
  const [activePanel, setActivePanel] = useState<'border' | 'color'>('border');
  const [borderColor, setBorderColor] = useState('#ffffff');
  
  // 1. Nilai default state sekarang termasuk padding
  const [frameStyle, setFrameStyle] = useState('rounded-lg p-4'); 
  const [clipPathStyle, setClipPathStyle] = useState('');
  
  const photostripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLayoutId = localStorage.getItem('selectedLayout');
    if (savedLayoutId && layoutMap[savedLayoutId as keyof typeof layoutMap]) {
      setLayout(layoutMap[savedLayoutId as keyof typeof layoutMap]);
    }

    // Tidak perlu lagi membaca 'uploadedImages' atau 'capturedImages' dari localStorage
  }, []);

  if (images.length === 0) {
    return (
      <div className="text-center text-purple-500 p-8">
        <h3 className="text-xl font-semibold">No Images to Edit</h3>
        <p className="text-sm mt-2">Please go back to capture or upload photos.</p>
      </div>
    );
  }

 const handleDownload = (format: 'png' | 'jpeg') => {
    if (photostripRef.current === null) return;

    const options = {
      cacheBust: true,
      backgroundColor: borderColor, // Gunakan borderColor untuk latar belakang
    };

    const filename = `ramon-photobooth.${format}`;

    if (format === 'png') {
      toPng(photostripRef.current, options)
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = filename;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => console.error('PNG download error:', err));
    } else if (format === 'jpeg') {
      // Untuk JPEG, kita bisa tambahkan opsi kualitas (0.0 - 1.0)
      toJpeg(photostripRef.current, { ...options, quality: 0.90 }) // Kualitas 90%
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = filename;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => console.error('JPEG download error:', err));
    }
  };
  
  
  const handleFrameStyleChange = (style: string) => {
      setFrameStyle(style);
      setClipPathStyle(''); // Reset clip-path saat gaya bingkai biasa dipilih
  }
  
  const handleClipPathChange = (clipPath: string) => {
      setFrameStyle(''); // Hapus gaya bingkai biasa
      setClipPathStyle(clipPath);
  }

  // Fungsi untuk menangani perubahan warna dari SketchPicker
  const handleColorChange = (color: ColorResult) => {
    setBorderColor(color.hex); 
  };

  if (images.length === 0) {
    return (
      <div className="text-center text-purple-500 p-8">
        <h3 className="text-xl font-semibold">No Image to Edit</h3>
        <p className="text-sm mt-2">Please capture or upload photos first!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <div className="flex flex-col items-center gap-4">
        {/* 2. `className` sekarang dihapus, karena dikontrol oleh state `frameStyle` */}
        <PhotostripPreview
          ref={photostripRef}
          layout={layout}
          images={images}
          borderColor={borderColor}
          borderStyle={frameStyle} // Menggunakan state frameStyle
          clipPathStyle={clipPathStyle}
        />
        {/* Tombol download tidak berubah */}
      </div>
      {/* Kolom Kanan: Panel Kontrol Edit */}
<div className="w-full bg-purple-50 p-4 rounded-2xl flex-shrink-0 flex flex-col"> {/* Tambahkan flex flex-col di sini */}
  {/* Bagian Tab Atas (Border & Color) */}
  <div className="flex justify-around mb-4 border-b border-purple-200">
    {[
      { label: 'Border', icon: <FaBorderAll />, panel: 'border' },
      { label: 'Color', icon: <FaPalette />, panel: 'color' },
    ].map(item => (
      <button
        key={item.label}
        onClick={() => setActivePanel(item.panel as 'border' | 'color')}
        className={`p-3 text-2xl transition-colors ${activePanel === item.panel ? 'text-purple-700' : 'text-purple-300 hover:text-purple-500'}`}
      >
        {item.icon}
      </button>
    ))}
  </div>

  {/* Konten Panel yang Aktif */}
  <div className="flex-grow"> {/* Tambahkan flex-grow agar panel ini mengisi ruang */}
{activePanel === 'border' && (
          <div className="space-y-3 animate-fade-in">
            <h4 className="font-semibold text-purple-800">Frame Style</h4>
            {/* 3. Panel Border diperbarui dengan opsi Polaroid */}
            <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleFrameStyleChange('p-3')} className="h-16 border-2 border-purple-300 bg-white flex items-center justify-center text-purple-400">Thin</button>
                <button onClick={() => handleFrameStyleChange('rounded-xl p-4')} className="h-16 border-2 border-purple-300 bg-white rounded-xl flex items-center justify-center text-purple-400">Rounded</button>
                {/* Tombol Polaroid */}
                <button onClick={() => handleFrameStyleChange('rounded-md px-3 pt-3 pb-18')} className="h-16 border-2 border-purple-300 bg-white rounded-md flex items-center justify-center text-purple-400">
                  <FaImages className="mr-2"/> Polaroid
                </button>
                 <button onClick={() => handleFrameStyleChange('rounded-full p-5')} className="h-16 border-2 border-purple-300 bg-white rounded-full flex items-center justify-center text-purple-400">Circle</button>
            </div>
          </div>
        )}
    {activePanel === 'color' && (
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

  {/* Pembungkus Tombol Download diletakkan di sini, di bawah konten panel */}
  <div className="mt-auto pt-6 flex flex-col sm:flex-row gap-3"> {/* mt-auto akan mendorong ke bawah jika ada ruang, pt-6 untuk padding atas */}
    <button 
      onClick={() => handleDownload('png')} 
      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white font-semibold rounded-lg shadow-lg hover:bg-purple-700 transition-transform hover:scale-105 text-sm"
    >
      <FaDownload/> PNG
    </button>
    <button 
      onClick={() => handleDownload('jpeg')} 
      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 text-white font-semibold rounded-lg shadow-lg hover:bg-violet-700 transition-transform hover:scale-105 text-sm"
    >
      <FaDownload/> JPG
    </button>
  </div>
</div>
      
    </div>
  );
}