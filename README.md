# Ramon

Photobooth berbasis browser dengan Next.js 15, React 19, TypeScript, dan Tailwind CSS 4. Pilih layout, gunakan kamera atau unggah foto, tambahkan bingkai, filter, stiker, dan caption, lalu simpan PNG atau JPG.

UI lavender dengan layout yang menyesuaikan perangkat: kamera portrait di HP, area kerja berdampingan di tablet/desktop, serta kontrol warna native. Rincian ada di [catatan desain UI](docs/UI-REDESIGN.md).

Editor menyediakan 25 layout, 8 gaya bingkai, 24 pilihan warna dan warna bebas, 7 pilihan pola termasuk polos, 12 filter dengan penyesuaian foto, caption, serta 60 stiker lokal (Nailong, Stitch/Angel, dan Twemoji). Stiker bisa digeser, diputar, dibalik, diubah ukurannya, diduplikasi, diatur urutan layer-nya, atau diunggah sendiri. Lihat [catatan kustomisasi](docs/CUSTOMIZATION.md); kredit tersedia di halaman `/sticker-credits`.

## Menjalankan

Mode dua orang tersedia di `/together`. Room memakai Supabase, preview kamera lokal, satu foto per slot tanpa urutan giliran, dan editor kolaboratif dengan sinkronisasi otomatis melalui Realtime. Link undangan langsung membuka alur Join. Konfigurasi project, hosting, serta job pembersihan foto dijelaskan di [panduan room](docs/ROOMS.md).

Gunakan Node.js 22 LTS atau versi LTS yang lebih baru dan npm.

```sh
npm ci
npm run dev
```

Buka `http://localhost:3000/photobooth`. Kamera membutuhkan HTTPS pada hosting atau localhost saat pengembangan. Tidak ada environment variable atau backend yang wajib disiapkan. Font dan stiker disimpan lokal; build tidak perlu menghubungi Google Fonts atau sumber stiker.

```sh
npm run build
npm start
```

Di Windows PowerShell yang memblokir skrip `.ps1`, gunakan `npm.cmd` dan `npx.cmd`.

## Pemeriksaan

```sh
npm run lint
npm run typecheck
npm test
npx playwright install chromium webkit
npm run build
npm run test:e2e
npm audit --omit=dev
```

Browser test menjalankan build produksi di `http://127.0.0.1:3100`. Jangan menjalankannya bersamaan dengan build lain pada folder `.next` yang sama. Chromium memakai kamera sintetis; WebKit menggunakan profil iPad mobile dan desktop. Hasil tes ada di `test-results/` dan trace disimpan untuk tes yang gagal.

## Pengelolaan foto dan ekspor

- Foto diproses di browser; kode aplikasi tidak mengunggahnya ke server.
- Satu sesi React menyimpan layout, foto, dan seluruh desain dengan undo/redo hingga 30 langkah. Pindah tab mempertahankan pengaturan; mengganti layout mengosongkan foto dan mempertahankan desain. Refresh atau meninggalkan halaman mengakhiri sesi.
- Foto dinormalisasi ke JPEG kualitas 0.92, sisi terpanjang maksimal 1920 piksel. Foto besar tidak disimpan sebagai base64 di `localStorage`.
- HEIC dicoba melalui decoder native terlebih dahulu; `heic2any` dimuat hanya sebagai fallback.
- Ekspor mengikuti ukuran/crop preview dan dibatasi 4 juta piksel dengan sisi maksimal 4096. PNG/JPG disiapkan sebelum tombol simpan aktif, sehingga native Share dapat dipanggil langsung dari klik.
- iOS/iPadOS menggunakan file sharing jika tersedia; browser lain atau perangkat tanpa dukungan file sharing menggunakan download biasa.
- Batal dari native Share tidak memicu download tambahan. Gambar yang gagal diproses tidak diganti file kosong.

Lihat [audit refactor](docs/REFACTOR-AUDIT.md) untuk temuan, arsitektur, riwayat bug, dan checklist pengujian iPad fisik.
