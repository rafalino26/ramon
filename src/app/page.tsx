import Link from "next/link";
import {
  FiArrowRight,
  FiArrowUpRight,
  FiCamera,
  FiGrid,
  FiHeart,
  FiLock,
  FiSliders,
} from "react-icons/fi";
import MemoryArt, { Flower } from "./components/MemoryArt";

export default function HomePage() {
  return (
    <div className="page-width home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <Flower /> YOUR HAPPY LITTLE PHOTOBOOTH
          </span>
          <h1>
            Little moments.
            <br />
            <span className="playful-text">Lovely memories.</span>
          </h1>
          <p>
            A silly face. Your favourite people. An ordinary afternoon.
            <br className="desktop-break" /> Turn it into something worth
            keeping.
          </p>
          <div className="hero-actions">
            <Link
              href="/photobooth"
              className="button button-primary button-large"
            >
              <FiCamera /> Make a memory <FiArrowUpRight />
            </Link>
            <a href="#how-it-works" className="text-link">
              How it works <FiArrowRight />
            </a>
          </div>
          <div className="hero-reassurance">
            <span>
              <FiLock /> Just in your browser
            </span>
            <span>
              <FiHeart /> No account needed
            </span>
          </div>
        </div>
        <MemoryArt />
      </section>
      <section id="how-it-works" className="how-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A FEW CLICKS, A LITTLE MAGIC</span>
            <h2>Good memories. Easy as one, two, three.</h2>
          </div>
          <Flower className="section-flower" />
        </div>
        <div className="how-grid">
          {[
            {
              icon: FiGrid,
              number: "01",
              title: "Pick your little layout",
              text: "A classic photo strip or a playful grid? Find a shape that feels like you.",
            },
            {
              icon: FiCamera,
              number: "02",
              title: "Get in the frame",
              text: "Strike a pose with your camera, or bring along photos you already love.",
            },
            {
              icon: FiSliders,
              number: "03",
              title: "Make it yours",
              text: "Choose a frame, add your favourite colour, and save a little piece of the day.",
            },
          ].map(({ icon: Icon, number, title, text }) => (
            <article className="how-card" key={number}>
              <div>
                <span className="feature-icon">
                  <Icon />
                </span>
                <span className="step-index">{number}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="home-invitation">
        <div>
          <span className="eyebrow">NO OCCASION NECESSARY</span>
          <h2>Today looks good on you.</h2>
          <p>Come as you are. Leave with a memory.</p>
        </div>
        <Link href="/photobooth" className="button button-primary">
          Let’s take a photo <FiArrowRight />
        </Link>
        <Flower />
      </section>
    </div>
  );
}
