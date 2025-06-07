'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Webcam from 'react-webcam';
import { FaCamera, FaCheckCircle, FaRedo, FaHourglassHalf, FaSyncAlt, FaTrash } from 'react-icons/fa';
import { layoutMap, LayoutInfo } from '@/lib/layout';

interface CameraProps {
  onCaptureComplete: (images: string[]) => void;
}

const flipImageHorizontally = (dataUrl: string): Promise<string> => {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            if (ctx) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0);
            }
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = dataUrl;
    });
};

export default function Camera({ onCaptureComplete }: CameraProps) {
  const webcamRef = useRef<Webcam>(null);
  const [photoToDelete, setPhotoToDelete] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [timer, setTimer] = useState<number>(0);
  const [filter, setFilter] = useState('normal');
  const [layout, setLayout] = useState<LayoutInfo>(
    layoutMap['2x2'] || { id: 'default', label: 'Default', rows: 1, cols: 1 }
  );
  
  const [capturedImages, setCapturedImages] = useState<(string | null)[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [isWidescreen, setIsWidescreen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceIndex, setActiveDeviceIndex] = useState(0);

  const totalSlots = layout.rows * layout.cols;
  const capturedCount = capturedImages.filter(Boolean).length;
  const isComplete = capturedCount === totalSlots;

  const relevantCameras = useMemo(() => {
    const term = facingMode === 'user' ? 'front' : 'back';
    return devices.filter(
      d => d.kind === 'videoinput' && d.label.toLowerCase().includes(term)
    );
  }, [devices, facingMode]);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(mediaDevices);
      } catch(err) {
        console.error("Error getting devices:", err);
      }
    };
    getDevices();
  }, []);
  
  useEffect(() => {
      setActiveDeviceIndex(0);
  }, [facingMode]);

  useEffect(() => {
    const savedLayoutId = localStorage.getItem('selectedLayout');
    const newLayout = savedLayoutId && layoutMap[savedLayoutId as keyof typeof layoutMap]
      ? layoutMap[savedLayoutId as keyof typeof layoutMap]
      : layoutMap['2x2'] || { id: 'default', label: 'Default', rows: 1, cols: 1 };
    
    setLayout(newLayout);
    setCapturedImages(Array(newLayout.rows * newLayout.cols).fill(null));
  }, []);

  const videoConstraints = {
    width: { ideal: 1920, min: 1280 },
    height: { ideal: 1080, min: 720 },
    aspectRatio: isWidescreen ? 16 / 9 : 4 / 3,
    facingMode: facingMode,
    deviceId: relevantCameras[activeDeviceIndex]?.deviceId,
  };

  const cycleNextCamera = () => {
    if(relevantCameras.length > 1) {
        setActiveDeviceIndex((prevIndex) => (prevIndex + 1) % relevantCameras.length);
    }
  };

  const applyFilterStyle = (f: string) => {
    switch (f) {
      case 'b&w': return 'grayscale(100%)';
      case 'vintage': return 'sepia(50%)';
      case 'vivid': return 'saturate(200%)';
      case 'cool': return 'contrast(120%) brightness(110%)';
      case 'warm': return 'brightness(120%) saturate(120%)';
      default: return 'none';
    }
  };

  const handleCapture = async () => {
    if (isCapturing || isComplete || !webcamRef.current) return;
    
    const performCapture = async () => {
      let imageSrc = webcamRef.current?.getScreenshot();
      if (imageSrc) {
        if (facingMode === 'user') {
          imageSrc = await flipImageHorizontally(imageSrc);
        }
        
        const firstEmptyIndex = capturedImages.findIndex(img => img === null);
        if (firstEmptyIndex !== -1) {
          const newImages = [...capturedImages];
          newImages[firstEmptyIndex] = imageSrc;
          setCapturedImages(newImages);
        }
      }
      setIsCapturing(false);
    };

    if (timer > 0) {
      setIsCapturing(true); setCountdown(timer);
      const timerId = setInterval(() => setCountdown(prev => prev - 1), 1000);
      setTimeout(() => {
        clearInterval(timerId); setCountdown(0);
        performCapture();
      }, timer * 1000);
    } else {
      await performCapture();
    }
  };

  const handleReset = () => {
    setCapturedImages(Array(totalSlots).fill(null));
    setFacingMode('user');
    setTimer(0);
    setFilter('normal');
    setIsWidescreen(false);
  };

    const handleSelectPhotoForDeletion = (index: number) => {
    // Jika foto yang sama diklik lagi, batal pilih (sembunyikan tombol hapus)
    if (photoToDelete === index) {
      setPhotoToDelete(null);
    } else {
      // Jika foto lain yang diklik, pilih foto tersebut
      setPhotoToDelete(index);
    }
  };

    const handleDeletePhoto = (indexToDelete: number) => {
    const newImages = [...capturedImages];
    newImages[indexToDelete] = null;
    setCapturedImages(newImages);
    setPhotoToDelete(null); // Reset pilihan setelah foto dihapus
  };
  
  const handleContinueToEdit = () => {
      // Filter gambar null sebelum mengirim ke induk
      const finalImages = capturedImages.filter(Boolean) as string[];
      
      // Panggil fungsi dari parent, jangan gunakan localStorage
      onCaptureComplete(finalImages);
    };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex gap-2">
            <button onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="px-3 py-2 bg-purple-100 text-purple-600 rounded-lg text-sm">Switch Cam</button>
            {relevantCameras.length > 1 && (
              <button onClick={cycleNextCamera} className="px-3 py-2 bg-purple-100 text-purple-600 rounded-lg text-sm flex items-center gap-1 animate-fade-in"><FaSyncAlt/> Lens</button>
            )}
            <button onClick={() => setIsWidescreen(w => !w)} className="px-3 py-2 bg-purple-100 text-purple-600 rounded-lg text-sm">{isWidescreen ? 'Normal AR' : 'Wide AR'}</button>
        </div>
        <div className="flex space-x-2">
          <span className='self-center text-sm mr-2 text-purple-700'>Timer:</span>
          {[0, 3, 5, 10].map((t) => (
            <button key={t} onClick={() => setTimer(t)} className={`w-10 h-10 rounded-full text-sm font-semibold ${timer === t ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-500'}`}>{t === 0 ? 'Off' : `${t}s`}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="relative w-full aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden shadow-lg">
            <Webcam
              ref={webcamRef} audio={false} screenshotFormat="image/png"
              screenshotQuality={1} forceScreenshotSourceSize={true}
              videoConstraints={videoConstraints}
              className="w-full h-full object-cover"
              style={{ filter: applyFilterStyle(filter), transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
            {isCapturing && countdown > 0 && (
              <div className="absolute inset-0 flex justify-center items-center z-30">
                <span className="text-white text-9xl font-bold drop-shadow-lg [text-shadow:0px_4px_8px_rgba(0,0,0,0.7)]">
                  {countdown}
                </span>
              </div>
            )}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)', 
                width: '95%', height: '95%',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                aspectRatio: `${layout.cols} / ${layout.rows}`,
              }}
            />
          </div>
          
          <div className="flex justify-center items-center gap-4 pt-2">
            <button onClick={handleReset} className="flex items-center gap-2 px-5 py-3 bg-gray-200 text-gray-700 rounded-full shadow-md font-semibold"><FaRedo /> Reset</button>
            <button onClick={handleCapture} disabled={isComplete || isCapturing} className="flex items-center gap-2 px-8 py-4 bg-purple-600 text-white rounded-full shadow-lg font-bold text-lg disabled:bg-purple-300 disabled:cursor-not-allowed">
                {isCapturing ? <FaHourglassHalf className="animate-spin"/> : <FaCamera />}
                Capture ({capturedCount}/{totalSlots})
            </button>
          </div>

          <div className="w-full pt-6">
            <div className="flex space-x-4 justify-center overflow-x-auto pb-2">
              {[{ label: 'Normal', value: 'normal' }, { label: 'B&W', value: 'b&w' }, { label: 'Vintage', value: 'vintage' }, { label: 'Vivid', value: 'vivid' }, { label: 'Cool', value: 'cool' }, { label: 'Warm', value: 'warm' }].map((f) => (
                <div key={f.value} onClick={() => setFilter(f.value)} className={`flex-shrink-0 flex flex-col items-center p-2 rounded-xl cursor-pointer w-24 ${filter === f.value ? 'bg-purple-200' : 'bg-purple-50'}`}>
                  <div className="w-full h-16 rounded-md mb-2 bg-gray-300" style={{ filter: applyFilterStyle(f.value) }}/>
                  <span className={`text-xs font-medium ${filter === f.value ? 'text-purple-700' : 'text-purple-500'}`}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div 
          className="w-full p-2 bg-gray-100 rounded-lg"
          style={{ aspectRatio: `${layout.cols} / ${layout.rows}` }}
        >
          <div className="grid h-full w-full gap-2" style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)`, gridTemplateRows: `repeat(${layout.rows}, 1fr)` }}>
             {Array.from({ length: totalSlots }).map((_, i) => (
              // 4. JSX diubah: group/group-hover dihapus, diganti onClick & class kondisional
              <div 
                key={i} 
                onClick={() => capturedImages[i] && handleSelectPhotoForDeletion(i)} // Klik div ini untuk memilih/batal
                className="bg-gray-300 rounded-md overflow-hidden flex justify-center items-center relative cursor-pointer"
              >
                {capturedImages[i] ? (
                  <>
                    <img 
                      src={capturedImages[i]} 
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        photoToDelete === i ? 'brightness-50' : '' // Efek gelap jika terpilih
                      }`} 
                      alt={`Capture ${i + 1}`} 
                    />
                    {/* Overlay yang tampilannya bergantung pada state 'photoToDelete' */}
                    <div className={`absolute inset-0 flex justify-center items-center transition-opacity duration-300 ${
                        photoToDelete === i ? 'opacity-100' : 'opacity-0 pointer-events-none' // Tampil/sembunyi berdasarkan state
                    }`}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // Mencegah klik menyebar ke div di belakangnya
                          handleDeletePhoto(i);
                        }} 
                        className="text-white text-4xl p-3 bg-black/40 rounded-full hover:bg-red-500/80 transform hover:scale-110 transition-all duration-200"
                        aria-label="Delete photo"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </>
                ) : (
                  <FaCamera className="text-gray-400 text-2xl"/>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {isComplete && (
         <button onClick={handleContinueToEdit} className="flex items-center mx-auto gap-2 px-8 py-3 rounded-lg text-white font-semibold shadow-lg transition bg-purple-500 hover:bg-purple-600 animate-pulse mt-4">
            <FaCheckCircle /> Continue to Editor
        </button>
      )}
    </div>
  );
}