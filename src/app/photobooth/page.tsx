// app/photobooth/page.tsx

"use client";

import { useState } from 'react';
import { FaCamera, FaLayerGroup, FaEdit } from 'react-icons/fa';
import Camera from '../components/camera';
import Layout from '../components/layout';
import Edit from '../components/edit';
import Link from 'next/link';

export default function PhotoboothPage() {
  const [activeTab, setActiveTab] = useState<'layout' | 'camera' | 'edit'>('layout');
  
  // 1. State untuk menyimpan gambar diangkat ke sini
  const [imagesToEdit, setImagesToEdit] = useState<string[]>([]);

  // 2. Fungsi untuk menangani data dari Camera dan beralih ke Edit
  const handleCaptureComplete = (capturedImages: string[]) => {
    setImagesToEdit(capturedImages);
    setActiveTab('edit');
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4">
    <h2 className="text-4xl font-bold text-gradient-animated font-coiny mb-2">
      <Link href="/">Ramon</Link>
    </h2>
      <p className="text-lg text-gradient-animated font-coiny mb-8">Capture your moments in style</p>

      <div className="flex w-full max-w-4xl bg-[#edddfd] p-1 rounded-t-2xl shadow-lg">
        {[
          { label: 'Layout', value: 'layout', icon: <FaLayerGroup /> },
          { label: 'Camera', value: 'camera', icon: <FaCamera /> },
          { label: 'Edit', value: 'edit', icon: <FaEdit /> },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as 'layout' | 'camera' | 'edit')}
            className={`flex items-center justify-center w-full py-2 space-x-2 rounded-lg ${
              activeTab === tab.value ? 'bg-purple-200 text-black' : 'text-gray-400'
            }`}
          >
            {tab.icon}
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-b-2xl shadow-lg w-full max-w-4xl">
        {activeTab === 'layout' && <Layout setActiveTab={setActiveTab} />}
        {/* 3. Kirim fungsi onCaptureComplete ke Camera */}
        {activeTab === 'camera' && <Camera onCaptureComplete={handleCaptureComplete} />}
        {/* 4. Kirim data gambar ke Edit melalui props */}
        {activeTab === 'edit' && <Edit images={imagesToEdit} />}
      </div>
    </div>
  );
}