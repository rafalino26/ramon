import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowRight, FiHeart, FiLock, FiSmile } from "react-icons/fi";
import MemoryArt, { Flower } from "../components/MemoryArt";

export const metadata: Metadata = { title: "Our story" };

export default function AboutUsPage() {
  return (
    <div className="page-width story-page">
      <section className="story-hero">
        <div>
          <span className="eyebrow">
            <Flower /> A LITTLE ABOUT US
          </span>
          <h1>
            Made for moments.
            <br />
            <span className="playful-text">Made with love.</span>
          </h1>
          <p className="lead">
            Hi, we’re Rafa &amp; Monik. Welcome to our happy little corner of
            the internet.
          </p>
          <p>
            We made Ramon for the little things: a laugh with a friend, a quiet
            day at home, or a photo that’s too lovely to leave in your camera
            roll.
          </p>
          <p>
            No special occasion. No perfect pose. Just a simple way to turn a
            moment into something you can keep.
          </p>
          <Link href="/photobooth" className="text-link">
            Make a memory with us <FiArrowRight />
          </Link>
        </div>
        <MemoryArt compact />
      </section>
      <section className="values-section">
        <span className="eyebrow">THE THINGS WE CARE ABOUT</span>
        <h2>A little simpler. A little sweeter.</h2>
        <div className="how-grid">
          {[
            {
              icon: FiSmile,
              title: "Easy feels better",
              text: "Choose a layout, take your photos, and make them your own. There’s no account to create.",
            },
            {
              icon: FiLock,
              title: "Your memories are yours",
              text: "Your photos are processed in your browser. We don’t upload them to a photo server.",
            },
            {
              icon: FiHeart,
              title: "A touch of personality",
              text: "Soft colours, playful frames, and room for all the wonderfully imperfect moments.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <article className="value-card" key={title}>
              <span className="feature-icon">
                <Icon />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
