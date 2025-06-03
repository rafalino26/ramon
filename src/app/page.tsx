// app/page.tsx

"use client";

import { useState } from 'react';
import { FaCamera, FaLayerGroup, FaEdit } from 'react-icons/fa';
import Camera from './components/camera';
import Layout from './components/layout';
import Edit from './components/edit';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'layout' | 'camera' | 'edit'>('camera');

  return (
    <div className="min-h-screen bg-[#f5ebff] flex flex-col items-center py-10 px-4">
      {/* Title */}
      <h2 className="text-4xl font-bold text-purple-800 mb-2">Ramon</h2>
      <p className="text-lg text-purple-500 mb-8">Capture your moments in style</p>

      {/* Tabs */}
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

      {/* Tab Content */}
      <div className="bg-white p-6 rounded-b-2xl shadow-lg w-full max-w-4xl">
        {/* 👇 Perubahan di sini: tambahkan prop setActiveTab */}
        {activeTab === 'layout' && <Layout setActiveTab={setActiveTab} />}
        {activeTab === 'camera' && <Camera setActiveTab={setActiveTab} />}
        {activeTab === 'edit' && <Edit />}
      </div>
    </div>
  );
}