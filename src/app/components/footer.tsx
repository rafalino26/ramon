import Link from "next/link";
import { FiHeart } from "react-icons/fi";
import { Flower } from "./MemoryArt";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="page-width footer-inner">
        <Link href="/" className="footer-brand">
          <Flower /> <span>ramon</span>
        </Link>
        <p>A little space for lovely memories.</p>
        <div>
          <Link href="/about-us">Our story</Link>
          <Link href="/contact">Say hello</Link>
        </div>
        <span className="footer-credit">
          Made with <FiHeart aria-label="love" /> by Rafa &amp; Monik
        </span>
      </div>
    </footer>
  );
}
