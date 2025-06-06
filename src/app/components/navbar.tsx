// app/components/Navbar.tsx
'use client';

import { useState } from 'react'; // 1. Impor useState
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { FaBars, FaTimes } from 'react-icons/fa'; // 2. Impor ikon untuk hamburger & close

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false); // 3. State untuk mengontrol menu mobile

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/photobooth', label: 'Photobooth' },
    { href: '/about-us', label: 'About Us' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <div className="sticky top-0 z-50 w-full flex justify-center py-4">
      <nav className="bg-white backdrop-blur-lg shadow-lg rounded-full flex items-center justify-between px-4 py-2 w-auto">
        {/* Logo selalu terlihat */}
        <Link href="/" onClick={() => setIsMenuOpen(false)}>
          <Image
            src="/ramonlogo.png"
            alt="Ramon Logo"
            width={100}
            height={28}
            priority
            className="h-7 w-auto"
          />
        </Link>

        {/* 4. Menu untuk desktop (sembunyi di layar kecil) */}
        <div className="hidden md:flex items-center gap-4 ml-4">
          <div className="h-6 w-px bg-purple-200"></div>
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
        
        {/* 5. Tombol hamburger untuk mobile (hanya tampil di layar kecil) */}
        <div className="md:hidden ml-4">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full text-purple-700 hover:bg-purple-100"
            aria-label="Open menu"
          >
            {isMenuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
          </button>
        </div>
      </nav>

      {/* 6. Panel menu mobile (muncul saat tombol hamburger di-klik) */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full mt-2 w-11/12 max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-fade-in">
          <div className="flex flex-col p-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMenuOpen(false)} // Menutup menu saat link di-klik
                className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                  pathname === item.href
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-700 hover:bg-purple-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}