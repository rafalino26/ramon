'use client';

import { useEffect, useRef, useState } from "react";

export default function CameraTab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facingMode, setFacingMode] = useState("user");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [timer, setTimer] = useState(0);
  const [filter, setFilter] = useState("none");

  const filters = [
    { name: "Normal", value: "none" },
    { name: "B&W", value: "grayscale(100%)" },
    { name: "Vintage", value: "sepia(70%)" },
    { name: "Vivid", value: "saturate(180%) contrast(120%)" },
    { name: "Cool", value: "hue-rotate(180deg)" },
  ];

  useEffect(() => {
    const initCamera = async () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
      });
      if (videoRef.current) videoRef.current.srcObject = newStream;
      setStream(newStream);
    };

    initCamera();
  }, [facingMode]);

  const handleCapture = () => {
    // Tambahkan logika simpan gambar nanti
    alert("Foto diambil!");
  };

  const handleReset = () => {
    alert("Reset layout!");
  };

  return (
    <div className="space-y-4">
      {/* Controls atas */}
      <div className="flex justify-between items-center">
        <div className="space-x-2">
          <button onClick={() => setFacingMode(prev => prev === "user" ? "environment" : "user")} className="bg-[#A47CA4] hover:bg-[#C8A2C8] text-white px-3 py-1 rounded transition">Switch Camera</button>
          <button className="bg-[#A47CA4] hover:bg-[#C8A2C8] text-white px-3 py-1 rounded transition">Wide/Normal</button>
        </div>

        {/* Timer */}
        <select
          className="border border-[#A47CA4] text-[#A47CA4] rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#C8A2C8]"
          onChange={(e) => setTimer(parseInt(e.target.value))}
          value={timer}
        >
          <option value={0}>Timer: Off</option>
          <option value={3}>3s</option>
          <option value={5}>5s</option>
          <option value={10}>10s</option>
        </select>
      </div>

      {/* Video */}
      <div className="w-full max-w-4xl mx-auto aspect-video rounded-xl overflow-hidden border-2 border-[#A47CA4] shadow-lg">
  <video
    ref={videoRef}
    autoPlay
    playsInline
    muted
    className="w-full h-full object-cover scale-x-[-1]"
    style={{ filter }}
  />
</div>


      {/* Tombol bawah */}
      <div className="flex justify-center gap-4">
        <button onClick={handleReset} className="bg-white border border-[#A47CA4] text-[#A47CA4] px-4 py-2 rounded-full hover:bg-[#E6DAF8] transition">Reset</button>
        <button onClick={handleCapture} className="bg-[#C8A2C8] hover:bg-[#A47CA4] text-white px-4 py-2 rounded-full transition">Capture</button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 flex-wrap justify-center mt-4">
        {filters.map(f => (
          <button
          key={f.name}
          onClick={() => setFilter(f.value)}
          className={`px-3 py-1 rounded-full border transition ${
            filter === f.value
              ? "bg-[#A47CA4] text-white border-transparent"
              : "border-[#C8A2C8] text-[#A47CA4] hover:bg-[#E6DAF8]"
          }`}
        >
          {f.name}
        </button>        
        ))}
      </div>
    </div>
  );
}
