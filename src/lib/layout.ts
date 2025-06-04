// lib/layouts.ts

// Definisikan tipe datanya sekali saja di sini
export interface LayoutInfo {
  id: string;
  label: string;
  rows: number;
  cols: number;
}

// Definisikan array layout sekali saja di sini
// Ini adalah "Single Source of Truth" kita
export const layouts: LayoutInfo[] = [
    { id: '4x1', label: '4 x 1', rows: 4, cols: 1 },
    { id: '3x1', label: '3 x 1', rows: 3, cols: 1 },
    { id: '2x1', label: '2 x 1', rows: 2, cols: 1 },
    { id: '3x2', label: '3 x 2', rows: 3, cols: 2 },
    { id: '1x2', label: '1 x 2', rows: 1, cols: 2 },
    { id: '2x3', label: '2 x 3', rows: 2, cols: 3 },
    { id: '2x2', label: '2 x 2', rows: 2, cols: 2 },
  ];

// Buat juga layoutMap dari array di atas agar tidak perlu mendefinisikan ulang
// Ini akan mengubah array menjadi objek, contoh: { '2x2': { id: '2x2', ... } }
export const layoutMap = layouts.reduce((acc, layout) => {
  acc[layout.id] = layout;
  return acc;
}, {} as Record<string, LayoutInfo>);