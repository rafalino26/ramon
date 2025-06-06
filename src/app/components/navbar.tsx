// app/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/photobooth', label: 'Photobooth' },
    { href: '/about-us', label: 'About Us' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    // 1. DIV PEMBUNGKUS untuk memposisikan navbar
    // - sticky top-0: Tetap di atas saat di-scroll
    // - w-full flex justify-center: Membuat kontainer selebar layar dan menempatkan isinya (navbar) di tengah
    // - py-4: Memberi jarak dari atas layar
    <div className="sticky top-0 z-50 w-full flex justify-center py-4">

      {/* 2. NAV SEKARANG MENJADI BENTUK "PIL" */}
      {/* - w-full dihapus agar lebarnya mengikuti konten
          - rounded-full ditambahkan untuk membuat sudutnya bulat sempurna
          - px-4 py-2 ditambahkan untuk padding di dalam pil */}
      <nav className="bg-white shadow-lg rounded-full flex items-center px-4 py-2">
        <div className="flex items-center gap-6">
          
          {/* Logo Ramon */}
          <Link href="/" className="flex items-center">
            <Image
              src="/ramonlogo.png" // Path ke logo di folder public
              alt="Ramon Logo"
              width={100} // Atur lebar logo (dalam piksel)
              height={28} // Atur tinggi logo (dalam piksel)
              priority // Prioritaskan loading logo karena penting
              className="h-7 w-auto" // Sesuaikan tinggi di sini & lebar otomatis
            />
          </Link>

          {/* Garis Pemisah Vertikal */}
          <div className="h-6 w-px bg-purple-200"></div>

          {/* 3. TATA LETAK MENU DISATUKAN */}
          <div className="flex items-baseline space-x-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-purple-100 hover:text-purple-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}