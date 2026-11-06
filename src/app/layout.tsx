import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Navbar from "./components/navbar";
import Footer from "./components/footer";

const geistSans = localFont({
  src: "./fonts/Geist-Latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const coiny = localFont({
  src: "./fonts/Coiny-Latin.woff2",
  variable: "--font-coiny",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ramon — Little moments, lovely memories",
    template: "%s · Ramon",
  },
  description:
    "Your happy little online photobooth. Pick a layout, take a photo, and turn a little moment into a memory. No account needed.",
};

export const viewport: Viewport = {
  themeColor: "#fcfaff",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${coiny.variable} antialiased`}>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Navbar />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
