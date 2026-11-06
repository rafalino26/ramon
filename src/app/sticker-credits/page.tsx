import Link from "next/link";
import type { Metadata } from "next";
import { Flower } from "../components/MemoryArt";

export const metadata: Metadata = { title: "Sticker credits" };
export default function StickerCredits() {
  return (
    <div className="page-width sticker-credits">
      <span className="eyebrow">
        <Flower /> LITTLE FRIENDS, LOVELY ARTISTS
      </span>
      <h1>Sticker credits.</h1>
      <p>A thank-you to the collections behind our little finishing touches.</p>
      <section>
        <h2>Nailong</h2>
        <p>
          25 existing character stickers from{" "}
          <a href="https://github.com/rafalino26/scrapbook-online">
            Rafa’s scrapbook collection
          </a>
          . Original community pack and image links are retained in{" "}
          <a href="/stickers/nailong/sticker-sources.json">the source list</a>.
          Nailong is a character of 第七印象文化传媒（深圳）有限公司. This
          collection is not an official release or an endorsement.
        </p>
      </section>
      <section>
        <h2>Stitch &amp; Angel</h2>
        <p>
          11 existing stickers from{" "}
          <a href="https://github.com/rafalino26/moncinox_vault/tree/main/public/stickers">
            Rafa’s Moncinox Vault collection
          </a>
          . Stitch and Angel are Disney characters. Transparent margins were
          trimmed and the files were resized/converted to WebP for this editor;
          the character art was not redrawn.
        </p>
      </section>
      <section>
        <h2>Cute little extras</h2>
        <p>
          24 graphics from{" "}
          <a href="https://github.com/jdecked/twemoji/tree/v16.0.1">
            Twemoji v16.0.1
          </a>
          , graphics copyright Twitter and other contributors, used under{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
          Original SVG artwork is included unchanged.{" "}
          <a href="/stickers/cute/LICENSE-GRAPHICS.txt">License text</a>.
        </p>
      </section>
      <p className="editor-hint">
        Character ownership and source notes are retained with the assets.
        Inclusion here does not claim an unrestricted character license.
      </p>
      <Link href="/photobooth" className="button button-primary">
        Back to your memory →
      </Link>
    </div>
  );
}
