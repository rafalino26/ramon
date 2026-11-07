"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FiArrowUpRight, FiCamera, FiMenu, FiX } from "react-icons/fi";

const links = [
  { href: "/", label: "Home" },
  { href: "/photobooth", label: "Photobooth" },
  { href: "/together", label: "Together" },
  { href: "/about-us", label: "Our story" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <nav className="page-width navigation" aria-label="Main navigation">
        <Link
          href="/"
          className="brand"
          aria-label="Ramon home"
          onClick={() => setOpen(false)}
        >
          <Image
            src="/ramonlogo.png"
            alt="Ramon"
            width={120}
            height={36}
            priority
          />
        </Link>
        <div className="desktop-links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Link href="/photobooth" className="button button-primary nav-cta">
          <FiCamera /> Open the booth <FiArrowUpRight />
        </Link>
        <button
          type="button"
          className="icon-button mobile-menu-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? <FiX /> : <FiMenu />}
        </button>
      </nav>
      {open && (
        <nav
          id="mobile-navigation"
          className="mobile-navigation"
          aria-label="Mobile navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
              <FiArrowUpRight />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
