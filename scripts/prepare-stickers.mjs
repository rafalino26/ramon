import sharp from "sharp";
import { mkdir, readFile, writeFile, readdir, rename } from "node:fs/promises";
import path from "node:path";

const project = process.cwd();
const folder = path.join(project, "public/stickers/stitch");
const originals = path.join(project, ".references/sticker-originals");
await mkdir(originals, { recursive: true });
for (const filename of (await readdir(folder)).filter((name) =>
  name.endsWith(".png"),
)) {
  const source = path.join(folder, filename);
  const destination = path.join(folder, filename.replace(/\.png$/, ".webp"));
  await sharp(source)
    .trim({ threshold: 5 })
    .resize({
      width: 384,
      height: 384,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 94 })
    .toFile(destination);
  await rename(source, path.join(originals, filename));
  process.stdout.write(`${filename} -> ${path.basename(destination)}\n`);
}
const manifestPath = path.join(project, "public/stickers/sources.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
for (const asset of manifest) {
  if (asset.group === "stitch") {
    asset.path = asset.path.replace(/\.png$/, ".webp");
    asset.transformation =
      "Transparent margins trimmed; bounded to 384px; WebP quality 94. Character artwork unchanged.";
  }
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
