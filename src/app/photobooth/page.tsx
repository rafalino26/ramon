// app/photobooth/page.tsx
export const dynamic = "force-dynamic";

import PhotoboothClient from "./components/PhotoboothClient";

export default function PhotoboothPage() {
  return <PhotoboothClient />;
}
