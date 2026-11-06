# Kustomisasi photobooth

Editor tetap menggunakan tema lavender dan memisahkan kontrol menjadi Frame, Color, Filters, Stickers, dan Text. Preview tetap terlihat saat pengguna membuka kontrol di HP. Strip panjang dapat digulir di area preview.

## Pilihan desain

- 25 layout: strip 2–6 foto, grid hingga 9 foto, portrait, serta Spotlight, Side story, Mosaic, dan Panorama dengan ukuran slot yang berbeda.
- 8 bingkai: Thin, Rounded, Polaroid, Circle, Film, Postcard, Double, dan Inset. Ketebalan bingkai, jarak foto, dan bentuk sudut foto dapat diatur terpisah.
- 24 warna preset, input hex, pemilih warna bebas, serta pola dots, hearts, stars, stripes, checker, grid, dan polos. Warna pola dapat diubah.
- 12 filter dengan intensitas, brightness, contrast, dan saturation. Pengaturan pada editor diterapkan ke seluruh foto; filter kamera diterapkan saat pengambilan foto.
- Caption hingga 48 karakter, tiga jenis font, ukuran, dan warna teks. Caption diperkecil untuk strip sempit agar tetap muat dalam satu baris.
- 60 stiker lokal: 25 Nailong, 11 Stitch/Angel, dan 24 Twemoji. Pencarian, kategori, drag, ukuran, rotasi, flip, duplikasi, urutan layer, daftar stiker terpasang, dan hapus tersedia. Maksimal 24 stiker per desain.
- Unggah stiker PNG, WebP, GIF, atau JPG hingga 15 MB. File dinormalisasi ke PNG maksimal 512 px; transparansi dipertahankan. Animasi GIF menjadi gambar diam.
- Undo/redo menyimpan 30 langkah; satu gesture drag atau slider menjadi satu langkah. Ctrl/Cmd+Z dan Shift+Ctrl/Cmd+Z tersedia di luar input teks. Panah menggeser stiker yang sedang fokus; Shift memperbesar langkahnya.

## Implementasi

`src/lib/layout.ts` mendefinisikan geometri grid dan slot. Layout picker, kamera, dan preview memakai helper yang sama; layout kolase tidak membuat slot foto palsu di area yang membentang beberapa baris/kolom.

`src/lib/editor-design.ts` mendefinisikan desain. Sesi dan riwayat berada di reducer `photobooth-session.ts`, sehingga perpindahan tab tidak mereset desain. Blob URL stiker unggahan tetap dimiliki selama masih dipakai desain atau riwayat, lalu dilepas ketika tidak lagi diperlukan.

`photo-filters.ts` menyediakan definisi filter bersama untuk CSS preview, kamera, dan canvas. Browser tanpa `CanvasRenderingContext2D.filter` menggunakan operasi piksel sebagai fallback. `frame-art.ts` menyediakan definisi path bersama untuk SVG preview dan gambar vektor native di canvas. Pola ekspor menggunakan tile canvas, sehingga menghindari penolakan keamanan WebKit saat pola memakai gambar SVG.

Ekspor membaca posisi slot, radius sudut, dan baseline caption dari preview, lalu menggambar foto, caption, dan stiker sesuai urutan layer. Font ditunggu sebelum rendering teks. Semua aset stiker disajikan dari origin aplikasi sehingga tidak bergantung pada hotlink pihak ketiga atau canvas lintas origin. Batas 4 juta piksel/4096 px dan persiapan file sebelum klik simpan tetap dipertahankan untuk alur unduhan iPad.

## Sumber aset

- Nailong dari `rafalino26/scrapbook-online`, revisi `bd02fbd53c51088ccf437cb9d2072f80373f5bef`.
- Stitch/Angel dari `rafalino26/moncinox_vault`, revisi `44f0d19abeeff5c16da101d2ff19bd95dbb75226`.
- Tambahan lucu dari Twemoji v16.0.1, grafis CC BY 4.0. Lisensi disertakan bersama aset.

URL sumber terinci ada di `public/stickers/sources.json`; catatan sumber Nailong asli ikut disimpan. Halaman `/sticker-credits` menampilkan kredit. Kepemilikan karakter tetap pada pemiliknya; sumber repo tidak dianggap sebagai lisensi karakter tanpa batas.

Aset sudah termasuk dalam repo dan tidak perlu diunduh ulang saat build. Untuk memperbarui salinan dari sumber yang dipatok: jalankan `python scripts/fetch-stickers.py`, lalu `node scripts/prepare-stickers.mjs`. Langkah kedua menggunakan Sharp bawaan dependensi Next untuk memangkas margin transparan Stitch, membatasi ukuran 384 px, dan mengonversi ke WebP. Berkas asli unduhan disimpan di `.references/` yang diabaikan Git. Tidak ada foto pribadi atau musik dari repo referensi yang disalin.

## Validasi

Unit test memeriksa seluruh 25 geometri layout, keberadaan 60 aset dan sumbernya, normalisasi stiker, riwayat, serta operasi filter. Browser test memeriksa layout kolase/portrait/grid besar, upload stiker transparan, undo/redo lintas tab, filter fallback, dan piksel hasil PNG/JPG untuk foto, pola, caption, serta Nailong. Profil mencakup Chromium desktop/HP dan WebKit iPad mobile/desktop. Native Share pada perangkat iPad fisik tetap perlu diperiksa di perangkat tersebut; emulasi browser tidak menggantikan share sheet iOS.
