# Audit dan refactor Ramon

Catatan historis fase refactor sebelum perubahan UI. Desain dan perilaku antarmuka terbaru dijelaskan di [UI redesign](UI-REDESIGN.md).

Lingkup: kode dan perilaku aplikasi. Struktur halaman, teks utama, palet, kelas styling, dan susunan kontrol dipertahankan. Tidak ada backend, login, atau desain baru.

## Temuan dan penanganan

| Temuan awal | Dampak | Penanganan |
| --- | --- | --- |
| Foto unggahan disimpan di `localStorage`, editor hanya menerima state hasil kamera | Unggahan tidak masuk editor atau editor menampilkan foto sesi kamera sebelumnya | Satu reducer sesi untuk layout, slot foto, tab, bingkai, dan warna |
| `filter(Boolean)` menghapus slot kosong | Foto bergeser dari posisi yang dipilih pengguna | Slot menggunakan `string \| null` hingga tahap render dan ekspor |
| Komponen tab menyimpan foto sendiri dan di-unmount saat tab berubah | Draft hilang atau berbeda antar-tab | Foto dan pengaturan editor dimiliki parent; layout baru mereset slot hanya jika ukuran layout berubah |
| Foto base64 besar ditulis ke penyimpanan sinkron | Overhead string, blocking main thread, risiko quota | Blob URL sementara dengan kepemilikan dan cleanup yang jelas; foto hanya hidup selama sesi halaman |
| `heic2any` diimpor saat aplikasi dimuat | Decoder besar ikut jalur awal; modul browser berisiko dievaluasi di server | Native image decode dicoba lebih dulu; decoder HEIC dimuat dinamis hanya saat diperlukan |
| Deteksi HEIC hanya dari MIME | Sebagian file dengan MIME kosong tidak dikenali | Periksa MIME, sequence type, dan ekstensi |
| Foto resolusi asli terus digunakan di preview dan ekspor | Konsumsi memori besar pada ponsel/iPad | Normalisasi satu kali menjadi JPEG kualitas 0.92 dengan sisi terpanjang maksimal 1920 piksel |
| Dua `getUserMedia`: Webcam dan enumerasi perangkat | Stream tambahan tidak dihentikan, kamera dapat tetap aktif | Webcam menjadi satu-satunya pemilik stream; enumerasi tidak meminta stream tambahan |
| Timer dan callback async tidak dibatalkan | Foto muncul setelah reset atau keluar tab; race pada tangkapan | AbortController, guard sinkron, cleanup timer/shutter, dan pembaruan slot melalui reducer |
| Resolusi kamera memakai batas minimum yang ketat | Kamera yang mendukung resolusi lebih kecil dapat gagal | Gunakan constraint ideal dan pemilihan lensa eksplisit saat dibutuhkan |
| Filter hanya CSS pada video | Foto tersimpan tidak sesuai filter preview | Filter diaplikasikan pada canvas tangkapan; fallback piksel untuk browser tanpa Canvas filter |
| Screenshot PNG diubah lagi hanya untuk mirror | Encode/decode ekstra dan string base64 besar | Gambar video langsung ke canvas dengan transform mirror, lalu encode JPEG satu kali |
| Export punya ukuran/padding/gap terpisah dari preview | Crop, polaroid, dan proporsi hasil berbeda | Ukur kotak preview dan setiap slot; render canvas mengikuti geometri tersebut |
| Clip bingkai hanya berlaku pada background | Foto bisa keluar dari rounded/circle saat ekspor | Clip mencakup seluruh komposisi; JPEG diberi latar putih di area transparan |
| Handler `onload` dipasang setelah `src` | Gambar cache berpotensi selesai sebelum handler siap | Pasang handler sebelum `src`, dengan timeout dan pembatalan |
| Kegagalan satu foto ditelan, fallback mengekspor canvas kosong | Download tampak berhasil tetapi foto hilang | Gagal secara eksplisit; jangan menyediakan file parsial atau pengganti kosong |
| Deteksi iOS hanya `/iPad\|iPhone\|iPod/` | iPad dengan user agent Macintosh tidak memakai jalur Apple | Kenali user agent Macintosh dengan beberapa touch point; kapabilitas share tetap diperiksa |
| Web Share dipanggil setelah decode dan encode panjang | Aktivasi dari klik dapat kedaluwarsa | Siapkan PNG/JPG saat preview berubah; panggil share langsung dari klik menggunakan file siap pakai |
| Pembatalan share dianggap kegagalan | Download tambahan terjadi walau pengguna membatalkan | `AbortError` menghentikan proses tanpa fallback |
| Object URL download segera dicabut | Safari berisiko belum selesai mengambil file | Tunda pencabutan URL handoff 60 detik; URL sumber sesi dibersihkan terpisah |
| Alokasi canvas bergantung deteksi iOS | iPad desktop mode lolos batas memori | Semua platform memakai batas output 4 juta piksel dan sisi maksimal 4096 |
| Library ekspor lama dan helper tidak terpakai | Dependency dan kode membengkak | Hapus `html-to-image`, `html2canvas`, helper/debug/fallback mati, serta state styling yang duplikat |
| Kamera dan editor diimpor pada jalur awal | Kode fitur yang belum digunakan ikut dimuat | Chunk kamera/editor/color picker dimuat sesuai kebutuhan |
| `/photobooth` dipaksa dynamic walau tidak memakai data server | Render server per permintaan tidak diperlukan | Halaman dapat di-prerender statis |
| `next lint` tanpa konfigurasi lint | Pemeriksaan repo tidak bisa dijalankan dengan benar | ESLint, typecheck, unit test, dan browser test tersedia sebagai skrip npm |
| Root build terdeteksi ke direktori parent | Warning multiple lockfiles dan penelusuran file di luar proyek | Tetapkan `outputFileTracingRoot` ke root proyek |
| Konfigurasi Tailwind lama tidak dimuat oleh setup v4 | Konfigurasi membingungkan dengan path source yang tidak sesuai | Hapus konfigurasi yang tidak aktif; CSS v4 yang sudah dipakai tetap sama |
| Dependency lama memiliki temuan keamanan | Risiko dari framework/dependency yang sudah memiliki patch | Patch Next.js 15, pembaruan kompatibel, dan override PostCSS dalam major 8; lihat hasil audit saat ini |

## Riwayat bug download

Riwayat Git lokal dari origin `https://github.com/rafalino26/ramon.git` memuat commit:

- `e393acb` — `feat: ios dw bug again`
- `0c975d9` sampai `488b12b` — `fix: dw bug` sampai `fix: dw bug 5`

Perubahan sebelumnya berpindah dari ekspor DOM ke canvas dan menambahkan konversi HEIC serta fallback download. Temuan di atas berasal dari kode dan riwayat ini. Akses ulang daftar issue GitHub melalui jaringan tidak berhasil, sehingga isi issue remote tidak digunakan sebagai bukti.

Aktivasi pengguna dan pembatalan share mengacu pada [dokumentasi Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share). Hubungan temuan tersebut dengan laporan pada perangkat tertentu masih perlu konfirmasi di iPad fisik; bukan klaim bahwa setiap bug lama sudah direproduksi.

## Arsitektur setelah refactor

- `src/lib/photobooth-session.ts`: transisi sesi yang bisa diuji tanpa browser.
- `src/hooks/use-photo-urls.ts`: kepemilikan URL foto dan pelepasan resource.
- `src/lib/images.ts`: decode, konversi HEIC, normalisasi, encode.
- `src/lib/camera.ts`: definisi filter dan tangkapan video.
- `src/lib/frames.ts`: satu definisi kelas bingkai untuk preview.
- `src/lib/export.ts`: pengukuran preview, crop, clipping, dan pembuatan file.
- `src/lib/download.ts`: native share dan download file.
- `src/hooks/use-prepared-export.ts`: debounce, pembatalan ekspor usang, dan kesiapan file.
- Komponen di `src/app/components`: markup dan interaksi tampilan yang sudah ada.

## Validasi dan batasnya

Hasil pemeriksaan pada refactor ini:

- `npm run build`: lulus; `/photobooth` menjadi halaman statis; First Load JS tercatat 116 kB. Ini ukuran bundle dari build, bukan benchmark kecepatan perangkat.
- `npm run lint`, `npm run typecheck`, dan `git diff --check`: lulus.
- `npm test`: 19/19 lulus.
- Suite browser utama: 21 lulus, 3 dilewati karena skenario khusus platform.
- Tes tambahan setelah penyesuaian terakhir kamera: 4 lulus, 2 dilewati; mencakup warna pada ketiga profil dan kamera dengan Canvas filter native dinonaktifkan.
- `npm audit --omit=dev`: 0 temuan. Audit seluruh dependency masih memiliki 14 temuan moderate pada tooling, dijelaskan di bawah.

Jalankan perintah di README. Browser test memakai Chromium dengan kamera sintetis, WebKit dengan profil iPad, serta profil iPad dengan user agent desktop. Pengujian memeriksa isi piksel file PNG/JPG, slot kosong, pergantian tab/layout, bingkai, aktivasi share, pembatalan share, countdown, dan penghentian stream.

Native Share Sheet dimock dalam pengujian. WebKit di Windows bukan iPadOS Safari fisik. Uji manual yang masih diperlukan sebelum menyatakan bug iPad selesai:

1. Safari iPad, mode mobile dan Request Desktop Website, orientasi portrait/landscape.
2. Foto kamera serta HEIC nyata dari Photos, termasuk foto berorientasi EXIF dan file berukuran besar.
3. Semua layout dan bingkai; PNG dan JPG; warna bingkai setelah diubah.
4. Save Image/Save to Files, pembatalan Share Sheet, dan pengulangan download setelah batal.
5. Kamera ditolak/tidak tersedia; reset saat countdown; pindah tab saat mengambil/mengunggah foto.

Tidak ada klaim peningkatan kecepatan dalam persen karena belum ada benchmark perangkat nyata. Perbaikan mengurangi pekerjaan yang tidak diperlukan dan membatasi ukuran resource; angka bundle produksi dicatat dari output build.

## Di luar refactor ini

Audit setelah pembaruan masih melaporkan 14 temuan moderate pada rantai tooling ESLint/minimatch. Tidak ada pembaruan mayor/downgrade otomatis dengan `npm audit fix --force`; rekomendasi resolver untuk tooling tersebut tidak kompatibel dengan konfigurasi Next.js 15 saat ini. Temuan produksi diverifikasi terpisah dengan `npm audit --omit=dev`.

Isi Home/About/Contact, judul metadata yang masih berbeda dari Ramon, dan desain responsif lama dipertahankan sesuai permintaan untuk tidak mengganti UI. Tidak ditambahkan penyimpanan permanen atau pemulihan foto setelah refresh. Normalisasi JPEG mengorbankan transparansi sumber dan sebagian detail resolusi asli untuk membatasi memori; PNG hasil ekspor tetap mendukung transparansi bingkai.
