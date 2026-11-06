import { FiHeart, FiStar } from "react-icons/fi";

export function Flower({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <ellipse
          key={angle}
          cx="50"
          cy="27"
          rx="13"
          ry="23"
          fill="currentColor"
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
      <circle cx="50" cy="50" r="15" fill="#fff0b7" />
      <path
        d="M44 52q6 7 12 0"
        stroke="#69503b"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="45" cy="46" r="1.5" fill="#69503b" />
      <circle cx="55" cy="46" r="1.5" fill="#69503b" />
    </svg>
  );
}

export function MiniScene({ variant = 0 }: { variant?: number }) {
  return (
    <div className={`mini-scene scene-${variant % 3}`} aria-hidden="true">
      {variant % 3 === 0 ? (
        <Flower />
      ) : variant % 3 === 1 ? (
        <svg viewBox="0 0 140 120" fill="none">
          <path
            d="M48 107q14-25 20-58m4 59q-1-28 18-49"
            stroke="#729879"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M49 83q-23-24-23-2 7 15 26 13m24-5q30-27 31-8-9 15-32 18"
            fill="#8db993"
          />
          <path
            d="M43 34 56 42 66 23 76 42 91 33q5 37-23 39-27-2-25-38Z"
            fill="#b795e8"
          />
          <path
            d="m78 48 9 5 9-14 8 15 12-6q4 28-18 29-22-2-20-29Z"
            fill="#f0b4c7"
          />
          <path d="m25 23 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="#a18ac5" />
        </svg>
      ) : (
        <svg viewBox="0 0 140 120" fill="none">
          <path
            d="M27 87q-14-29 9-40 16-5 29 15 12-28 32-20 29 14-5 46L65 109Z"
            fill="#bb9ce9"
          />
          <path
            d="M74 21q-4-16 7-17 10-1 13 12 8-8 16-3 12 10-9 25l-12 8Z"
            fill="#f1bacd"
          />
          <path
            d="m29 13 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm82 55 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"
            fill="#e2ba63"
          />
        </svg>
      )}
    </div>
  );
}

export default function MemoryArt({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`memory-art ${compact ? "art-compact" : ""}`}
      aria-label="Playful illustrated photo strips in lavender and pink"
    >
      <div className="art-orbit" />
      <span className="art-spark spark-one">
        <FiStar />
      </span>
      <span className="art-spark spark-two">
        <FiHeart />
      </span>
      <div className="sample-strip strip-back">
        <MiniScene variant={2} />
        <MiniScene variant={0} />
        <MiniScene variant={1} />
        <span>little moments ♡</span>
      </div>
      <div className="sample-strip strip-front">
        <MiniScene variant={0} />
        <MiniScene variant={1} />
        <MiniScene variant={2} />
        <span>made with ramon</span>
      </div>
      <span className="art-sticker">
        a little joy,
        <br />
        just for you.
      </span>
      <span className="art-note">
        memories look good on you <span>↗</span>
      </span>
    </div>
  );
}
