# Ramon — UI studio ungu

Desain baru diterapkan langsung ke repo Next.js yang sama. Tidak ada deployment atau layanan baru. Fondasi pengelolaan foto dan ekspor dari fase refactor tetap digunakan.

## Arah visual

- Lavender pucat sebagai latar; ungu untuk aksi utama; putih untuk ruang kerja; pink dan kuning lembut sebagai aksen ilustrasi.
- Geist untuk teks dan kontrol. Coiny dibatasi untuk aksen judul/wordmark agar mudah dibaca.
- Logo Ramon dipertahankan. Ilustrasi bunga, hati, dan strip foto dibuat sebagai vektor lokal tanpa permintaan gambar eksternal.
- Halaman Home, Our Story, Contact, navbar, footer, seluruh tahap photobooth, serta favicon diperbarui.
- FAQ memakai elemen `details` native, dan kontak tetap berupa `mailto:`. Tidak ada formulir yang seolah-olah mengirim data tanpa backend.

## Perilaku berdasarkan ruang layar

| Kondisi | Perilaku |
| --- | --- |
| HP portrait, lebar di bawah 640 px | Kamera otomatis 3:4, lebar disesuaikan dengan tinggi layar supaya tombol foto terjangkau; hasil berupa thumbnail mendatar |
| HP diputar landscape | Kamera kembali ke 4:3; tombol foto berada di samping preview dan filter menjadi select native agar kontrol tetap muat |
| Tablet/desktop | Kamera dan hasil berdampingan; editor dua kolom; tinggi kamera dibatasi mengikuti tinggi viewport |
| Mode Wide yang dipilih pengguna | Preview 16:9; Auto mengembalikan rasio yang sesuai layar |
| Pilihan layout pada HP | Delapan kartu ringkas; preview dekoratif besar disembunyikan untuk memperpendek alur |
| Editor pada HP | Preview di atas, kontrol dan tombol simpan di bawah; preset bingkai tampil satu baris |
| Semua ukuran | State foto tetap ada saat pindah tahap; perpindahan tahap kembali ke atas halaman |

Rasio tangkapan diambil dari kotak preview yang benar-benar terlihat. Video di-crop di canvas sebelum encode, sehingga tampilan portrait bukan sekadar CSS di atas file landscape. Penempatan foto di bingkai tetap mengikuti crop slot layout yang dipilih.

`svh` dan safe-area dipakai untuk ruang kamera pada HP. Rotasi atau perubahan rasio membatalkan countdown yang berjalan dan menunggu video siap kembali. Browser tanpa kamera tetap mendapat pesan dan aksi coba lagi; upload tersedia melalui tahap Layout.

## Interaksi dan ekspor

- Foto dapat dihapus langsung melalui tombol bin pada thumbnail, tanpa langkah memilih overlay terlebih dahulu.
- Pesan upload, kamera, dan ekspor muncul di halaman. Ekspor yang gagal dapat disiapkan ulang dengan Try again.
- Palet enam warna, input Hex, dan pemilih warna native menggantikan `react-color`; dependency lama dihapus.
- Grid preview memakai slot dengan ukuran yang pasti, sehingga tidak meluap akibat tinggi persentase pada container yang memakai padding.
- Ekspor tetap mengukur preview yang sama. Batas 4 juta piksel/4096 px dipertahankan; resolusi tidak lagi ditentukan oleh ukuran thumbnail preview semata.
- Share iPad, pembatalan Share, cleanup stream/timer/URL, dan guard file siap pakai tetap dipertahankan.
- Navigasi keyboard, label kontrol, focus ring, skip link, live status, dan prefers-reduced-motion disediakan.

## Pengujian

Pengujian mencakup Chromium desktop, profil HP Chromium, serta dua profil WebKit iPad. Screenshot halaman disimpan oleh `tests/browser/ui.spec.ts`; alur ekspor dan isi piksel file diperiksa oleh `photobooth.spec.ts`.

Profil HP memeriksa rasio kamera portrait, posisi tombol foto di viewport, rasio file tangkapan, dan perubahan saat rotasi. Seluruh halaman diperiksa terhadap overflow horizontal, error runtime, navigasi mobile, dan FAQ.

Native Share Sheet masih menggunakan mock. Pengujian Safari pada iPad/iPhone fisik serta file HEIC asli tetap diperlukan untuk verifikasi perilaku sistem operasi.

Hasil verifikasi:

- Build produksi, lint, TypeScript, dan 19 unit test lulus.
- Suite utama browser: 38 lulus, 6 dilewati sesuai platform.
- Pemeriksaan tambahan setelah penyesuaian landscape: 7 lulus, 5 dilewati. Termasuk ukuran 320×568, 375×667, 390×844, rotasi ke 844×390, desktop, dan profil iPad.
- Tes izin kamera ditolak lalu Try again pada HP kecil: lulus. Tombol retry tetap berada di dalam preview dan kamera dapat aktif kembali.
- Screenshot Home, Story, Contact, pilihan layout, kamera portrait/landscape, dan editor ditinjau secara visual.
- First Load JS `/photobooth` tercatat 111 kB pada build ini; setelah fase refactor sebelumnya 116 kB. Angka ini merupakan ukuran bundle, bukan benchmark performa kamera.
- `npm audit --omit=dev`: 0 temuan.
