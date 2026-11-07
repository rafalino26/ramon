import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: fileURLToPath(new URL(".", import.meta.url)) });

const config = [
  { ignores: [".next/**", ".references/**", ".test-build/**", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { files: ["src/app/together/RoomCamera.tsx"], rules: { "@next/next/no-img-element": "off" } },
  {
    files: ["src/app/components/{PhotoSlotImage,photostrip,StickerLayer}.tsx", "src/app/components/editor/StickerPanel.tsx"],
    // Session-owned blob URLs must be rendered directly, without the server image optimizer.
    rules: { "@next/next/no-img-element": "off" },
  },
  { files: ["tests/**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
];
export default config;
