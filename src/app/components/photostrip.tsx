// app/components/PhotostripPreview.tsx
'use client';

import { forwardRef, CSSProperties } from 'react';
import { LayoutInfo } from '@/lib/layout';
import { FaCamera } from 'react-icons/fa';

interface PhotostripPreviewProps {
  layout: LayoutInfo;
  images: (string | null)[]; // Terima array yang bisa berisi null
  borderColor?: string;
  borderStyle?: string;
  clipPathStyle?: string;
  className?: string;
}

const PhotostripPreview = forwardRef<HTMLDivElement, PhotostripPreviewProps>(
  ({ layout, images, borderColor, borderStyle, clipPathStyle, className }, ref) => {
    
    const totalSlots = layout.rows * layout.cols;

    return (
      // Kontainer luar sekarang tidak lagi memiliki aspectRatio
      <div
        ref={ref}
        className={`relative overflow-hidden shadow-lg ${className} ${borderStyle}`}
        style={{ 
          backgroundColor: borderColor, 
          clipPath: clipPathStyle,
        }}
      >
        {/* Kontainer grid di dalam sekarang yang memiliki aspectRatio */}
        <div
          className="grid h-full w-full gap-x-2 gap-y-4"
          style={{
            gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
            gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
            aspectRatio: `${layout.cols} / ${layout.rows}`, // <-- Properti ini pindah ke sini
          }}
        >
          {Array.from({ length: totalSlots }).map((_, i) => (
            <div key={i} className="bg-gray-300 overflow-hidden flex justify-center items-center">
              {images[i] ? (
                <img src={images[i]} className="w-full h-full object-cover" alt={`slot ${i + 1}`} />
              ) : (
                <FaCamera className="text-gray-400 text-2xl" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);

PhotostripPreview.displayName = 'PhotostripPreview';
export default PhotostripPreview;