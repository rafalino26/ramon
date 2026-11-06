import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowUpRight, FiCamera, FiMail, FiPlus } from "react-icons/fi";
import { Flower } from "../components/MemoryArt";

export const metadata: Metadata = { title: "Say hello" };
const questions = [
  {
    question: "Do I need an account?",
    answer:
      "No account, sign-in, or installation needed. Just open the photobooth in your browser and get started.",
  },
  {
    question: "Where do my photos go?",
    answer:
      "Your photos stay in your browser while you use the booth. Download your finished memory before refreshing or leaving the page, because your session won’t be saved.",
  },
  {
    question: "Can I use my own photos?",
    answer:
      "Of course. Choose a layout, tap Upload photos, and add a favourite photo to each slot. You can also use your camera.",
  },
  {
    question: "How do I save on an iPhone or iPad?",
    answer:
      "Once your photo is ready, tap PNG or JPG. If the share menu opens, choose Save Image or Save to Files. Other browsers download the file directly.",
  },
  {
    question: "Why isn’t my camera working?",
    answer:
      "Check that your browser has permission to use the camera and that another app isn’t using it. Then use Try again in the booth. You can always upload photos instead.",
  },
];

export default function ContactPage() {
  return (
    <div className="page-width contact-page">
      <section className="contact-intro">
        <span className="eyebrow">
          <Flower /> LET’S KEEP IN TOUCH
        </span>
        <h1>
          A question? An idea?
          <br />
          <span className="playful-text">Just say hello.</span>
        </h1>
        <p>
          Something not quite right, or a little idea to make Ramon better?
          <br className="desktop-break" /> We’d love to hear from you.
        </p>
      </section>
      <div className="contact-columns">
        <aside className="contact-card">
          <span className="feature-icon">
            <FiMail />
          </span>
          <h2>A little note to us.</h2>
          <p>For questions, feedback, or a friendly hello.</p>
          <a href="mailto:contact@ramon.com" className="contact-email">
            contact@ramon.com <FiArrowUpRight />
          </a>
          <Flower className="contact-flower" />
        </aside>
        <section className="faq-section">
          <span className="eyebrow">A FEW THINGS YOU MIGHT WONDER</span>
          <h2>Little questions, answered.</h2>
          <div className="faq-list">
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <FiPlus />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
      <div className="contact-bottom">
        <span>Ready for your close-up?</span>
        <Link className="text-link" href="/photobooth">
          Back to the booth <FiCamera />
        </Link>
      </div>
    </div>
  );
}
