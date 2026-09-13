# Spesifikasi Desain Target UI/UX Presensi SMAN 2 Cimalaka

Dokumen ini merupakan spesifikasi acuan tunggal dan sumber kebenaran desain target (single source of truth for target UI/UX) untuk rekonstruksi antarmuka Sistem Presensi SMAN 2 Cimalaka. Dokumen ini mendefinisikan tampilan visual, struktur tata letak, hierarki komponen, dan interaksi pengguna akhir yang siap diimplementasikan.

Spesifikasi ini menyelaraskan fondasi fungsional aplikasi yang ada dengan arah visual baru yang divalidasi melalui proyek Stitch (SMAN 2 Cimalaka Presensi, resource: `projects/9665208281408666152`).

---

## 1. Prinsip Desain (Design Principles)

### Fungsionalisme Akademis Modern (Modern Academic Functionalism)
1. **Fungsional dan Siap Operasional**: Antarmuka dirancang khusus untuk operasional harian sekolah menengah atas negeri. Setiap elemen visual harus memiliki kegunaan langsung untuk siswa, guru, atau administrator tanpa ornamen hiasan yang mengalihkan perhatian.
2. **Ketenangan Visual dan Kejelasan Data**: Mengutamakan permukaan putih bersih di atas kanvas abu-abu kebiruan yang tenang, tipografi berkontras tinggi, dan pemisahan informasi yang terstruktur.
3. **Ergonomi Khusus Peran**:
   - **Siswa**: Antarmuka seluler ringkas (mobile-first), ramah perangkat Android, dengan penekanan pada pemindaian kode QR presensi kamera langsung.
   - **Guru**: Dasbor pemantauan kelas untuk presensi manual cepat dan penayangan layar penuh proyektor (projector mode) untuk kode QR bersama.
   - **Administrator**: Ruang kerja data yang efisien, tabel berdensitas teratur, alur kerja master-detail, dan dialog interaktif terpandu.
4. **Bebas Pola AI Generik (Anti-AI-Slop)**:
   - Dilarang menggunakan gradasi warna latar yang mencolok, efek pantulan kaca (glassmorphism), atau efek blur dekoratif.
   - Dilarang menumpuk kartu berlebihan (card soup). Gunakan lembar kerja terstruktur dan tabel data bersih.
   - Dilarang membuat metrik statistik tiruan, analitik fiktif, atau grafik tanpa dukungan data riil basis data.
   - Dilarang menggunakan bentuk kapsul (pill) secara berlebihan. Sudut membulat penuh hanya digunakan untuk lencana status dan chip peran.
   - Dilarang menaruh ilustrasi kosong berukuran besar yang menyita ruang kerja operasional.

---

## 2. Identitas Visual Produk (Product Visual Identity)

### Karakter dan Nada Visual
Identitas visual memadukan ketertiban administratif sekolah dengan kesederhanaan perangkat lunak modern:
- **Warna Utama**: Biru Akademis (Academic Blue) mencerminkan wibawa institusi, ketertiban, dan keandalan sistem.
- **Warna Aksen**: Biru Langit (Sky Blue) memberikan kontras interaktif yang ramah pada menu aktif dan fokus navigasi.
- **Permukaan**: Dominasi warna putih murni pada kontainer kerja dan kartu data untuk menjaga legibilitas data presensi.
- **Hierarki Warna Semantik**: Warna hijau, kuning, biru, ungu, dan merah dipisahkan secara ketat hanya untuk status kehadiran dan status akun. Warna-warna ini dilarang digunakan sebagai dekorasi merek.

---

## 3. Aset Merek Resmi (Brand Assets)

Aplikasi menggunakan tiga berkas logo resmi SMAN 2 Cimalaka yang telah tersedia di dalam repositori pada direktori `public/logo/`. Dilarang memperkenalkan aset logo baru, menggambar ulang, mengubah warna lambang, atau membuat logo buatan AI.

### Spesifikasi Berkas Logo Repositori
1. **`public/logo/logo-color.png` (Logo Warna Resmi)**:
   - **Peruntukan**: Digunakan pada latar belakang terang, kartu autentikasi masuk (`/login`), halaman aktivasi mandiri (`/activate`), bilah atas aplikasi terang, dan bilah samping navigasi desktop berlatar putih.
   - **Dimensi Asli**: 895 x 1200 piksel (rasio aspek 0.746).
   - **Tinggi Acuan Tampilan**:
     - Header kartu login dan aktivasi: tinggi 54px hingga 64px.
     - Header bilah samping desktop: tinggi 36px.
     - Bilah atas ponsel (mobile topbar): tinggi 28px hingga 32px.
2. **`public/logo/logo-white.png` (Logo Putih Monokrom)**:
   - **Peruntukan**: Khusus digunakan jika terdapat bilah navigasi gelap, latar belakang biru pekat, atau kontainer dengan warna dasar pekat di mana logo warna tidak memenuhi rasio kontras WCAG AA.
3. **`public/logo/logo-bw.png` (Logo Hitam-Putih / Grayscale)**:
   - **Peruntukan**: Khusus dokumen cetak fisik, berkas unduhan PDF slip aktivasi siswa (`lib/students/student-activation-pdf.ts`), dan rekapitulasi kehadiran ramah cetak fotokopi.

Komponen bersama `components/school-logo.tsx` wajib digunakan sebagai pembungkus pemanggilan logo dengan prop `variant="color" | "white" | "bw"`.

---

## 4. Token Desain (Design Tokens)

### Palet Warna Permukaan dan Merek
Sistem token warna mengadopsi palet Stitch Academic Blue:

| Nama Token | Nilai Hex | Peran dan Penggunaan |
| :--- | :--- | :--- |
| `--surface-canvas` | `#f8f9ff` | Kanvas dasar seluruh halaman (slate sangat muda dengan rona biru halus). |
| `--surface-card` | `#ffffff` | Kontainer kartu data, modal, laci samping, dan lembar tabel kerja. |
| `--surface-low` | `#eff4ff` | Latar panel sekunder, rak bawah kartu login, dan header tabel data. |
| `--surface-container` | `#e6eeff` | Latar kontrol tersegmentasi, trek tab, dan baris terpilih. |
| `--surface-high` | `#dce9ff` | Aksen kontainer batas dan chip pendukung. |
| `--surface-highest` | `#d5e3fc` | Latar pembatas dekoratif minimal dan garis hover. |
| `--primary-base` | `#1e40af` | Biru akademis utama untuk tombol primer, judul aktif, dan ikon sorotan. |
| `--primary-dark` | `#00288e` | Biru akademis pekat untuk teks penekanan tinggi dan header tegas. |
| `--primary-hover` | `#1d4ed8` | Status hover interaktif pada tombol primer dan aksi utama. |
| `--primary-active` | `#1e3a8a` | Status tekan (active/pressed) pada tombol primer. |
| `--primary-tint` | `#dde1ff` | Isian lembut untuk indikator peran dan lencana terpilih. |
| `--secondary-base` | `#0284c7` | Biru langit untuk fokus input, tautan navigasi sekunder, dan garis aktif. |
| `--secondary-tint` | `#e0f2fe` | Latar belakang tautan navigasi aktif di bilah samping. |
| `--text-primary` | `#0d1c2e` | Teks utama dengan kontras tinggi (memenuhi standar AA/AAA). |
| `--text-secondary` | `#444653` | Teks deskripsi, label pembantu, dan instruksi alur kerja. |
| `--text-muted` | `#757684` | Placeholder input, teks waktu non-kritis, dan ikon non-interaktif. |
| `--border-subtle` | `#e2e8f0` | Garis batas netral pemisah kartu, baris tabel, dan pembatas navigasi. |
| `--border-medium` | `#cbd5e1` | Garis batas bidang input formulir dan tombol sekunder. |
| `--border-focus` | `#2563eb` | Cincin fokus keyboard yang tajam dan jelas. |

### Spektrum Warna Semantik Status Kehadiran
Warna status bersifat terstandarisasi di seluruh modul guru, siswa, dan admin:

| Status Kehadiran | Teks Status | Latar Lencana | Garis Batas | Makna Operasional |
| :--- | :--- | :--- | :--- | :--- |
| **Hadir Tepat Waktu** | `#15803d` | `#dcfce7` | `#86efac` | Presensi masuk sebelum batas toleransi keterlambatan. |
| **Terlambat** | `#b45309` | `#fef3c7` | `#fcd34d` | Presensi masuk melewati batas normal tetapi dalam rentang toleransi. |
| **Izin** | `#1d4ed8` | `#dbeafe` | `#93c5fd` | Ketidakhadiran dengan surat permohonan izin sah orang tua. |
| **Dispensasi** | `#0369a1` | `#e0f2fe` | `#7dd3fc` | Penugasan resmi sekolah (lomba, upacara, dinas OSIS). |
| **Sakit** | `#6d28d9` | `#ede9fe` | `#c4b5fd` | Ketidakhadiran disertai bukti surat keterangan dokter. |
| **Alfa / Kritis** | `#b91c1c` | `#fee2e2` | `#fca5a5` | Tanpa keterangan sah, akun terkunci, atau aksi bahaya. |
| **Belum Ditandai** | `#475569` | `#f1f5f9` | `#cbd5e1` | Sesi presensi aktif yang belum mencatat kehadiran siswa. |

### Sudut Membulat (Border Radius)
- **`rounded-sm` (4px)**: Checkbox, kotak penanda kecil, dan lencana kode teknis.
- **`rounded-md` (8px)**: Standar dasar untuk bidang input, tombol aksi, menu dropdown, dan kartu ringkas.
- **`rounded-xl` (12px hingga 16px)**: Kontainer kartu utama, panel filter kerja, modal konfirmasi, dan lembar kerja data.
- **`rounded-full` (9999px)**: Khusus lencana status kehadiran, chip peran pengguna, dan avatar inisial.

### Elevasi dan Bayangan (Elevation & Shadows)
- **Level 0 (Kanvas)**: Datar tanpa bayangan (`#f8f9ff`).
- **Level 1 (Kartu dan Tabel Data)**: Bayangan halus minimal (`box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05)`) dipadukan dengan garis batas tipis `1px solid #e2e8f0`.
- **Level 2 (Bilah Atas, Menu Dropdown, Popover)**: `box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)`.
- **Level 3 (Modal Dialog dan Laci Samping)**: `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)` dengan lapisan latar redup `rgba(15, 23, 42, 0.45)`.

---

## 5. Tipografi (Typography)

Sistem tipografi menggunakan Manrope sebagai satu-satunya rupa huruf antarmuka utama (single primary UI typeface) di seluruh aplikasi untuk judul halaman, teks isi (body), data tabel, formulir input, lencana status, tombol, dan teks navigasi:
- **Bobot Huruf Terstandarisasi**:
  - 700/800 (Bold / Extra Bold): Judul utama halaman dan angka metrik penting.
  - 600/700 (Semi-bold / Bold): Judul seksi modul, judul kartu, dan kontrol aksi utama.
  - 500/600 (Medium / Semi-bold): Label bidang formulir, judul kolom tabel, dan lencana status.
  - 400/500 (Regular / Medium): Teks isi deskriptif, baris data tabel, dan catatan pembantu.
- **Angka Tabular (Tabular Figures)**: Seluruh data waktu, jam presensi, NIS, NIP, persentase, dan tanggal wajib menggunakan pengaturan `font-feature-settings: 'tnum' 1` agar perataan kolom angka tersusun rapi.
- **Bebas Huruf Serif**: Dilarang menggunakan font serif di seluruh antarmuka aplikasi.
- **Ringan dan Terbaca Optimal**: Dioptimalkan agar ringan dan memiliki keterbacaan tinggi pada layar ponsel Android dan iPhone.

### Skala Tipografi Terstandarisasi

| Tingkat Tipografi | Rupa Huruf | Ukuran | Line Height | Berat | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Lg** | Manrope | 32px | 40px | 800 (Extra Bold) | -0.025em |
| **Display Mobile** | Manrope | 26px | 34px | 800 (Extra Bold) | -0.02em |
| **Headline Lg (H1)** | Manrope | 24px | 32px | 700 (Bold) | -0.02em |
| **Headline Md (H2)** | Manrope | 20px | 28px | 700 (Bold) | -0.015em |
| **Headline Sm (H3)** | Manrope | 16px | 24px | 600 (Semibold) | -0.01em |
| **Body Lg** | Manrope | 16px | 24px | 400 (Regular) | 0em |
| **Body Md** | Manrope | 14px | 20px | 400 (Regular) | 0em |
| **Body Sm** | Manrope | 12px | 18px | 400 (Regular) | 0em |
| **Label Lg** | Manrope | 14px | 20px | 600 (Semibold) | 0.01em |
| **Label Md** | Manrope | 12px | 16px | 600 (Semibold) | 0.02em |
| **Label Sm / Eyebrow**| Manrope | 11px | 14px | 600 (Semibold) | 0.04em (Uppercase) |
| **Kode Monospace** | JetBrains Mono / Monospace | 14px | 20px | 600 (Bold) | 0.05em |

---

## 6. Sistem Spasi dan Ukuran (Spacing and Sizing)

Menggunakan skala kelipatan 4px dan 8px:
- `space-xs`: 4px (jarak mikro antar teks dan ikon kecil).
- `space-sm`: 8px (jarak tombol horizontal, celah antar lencana, padding tombol kecil).
- `space-md`: 16px (padding default input, jarak antar elemen formulir, padding sel tabel longgar).
- `space-lg`: 24px (padding internal kartu modul kerja, jarak vertikal antar seksi).
- `space-xl`: 32px (jarak antar modul utama pada layar desktop).
- `gutter-mobile`: 12px (margin tepi kontainer pada layar ponsel sempit).
- `gutter-desktop`: 20px (jarak kolom kisi pada ruang kerja desktop).
- `margin-page-mobile`: 16px.
- `margin-page-desktop`: 32px.

### Standar Target Sentuh Seluler
Semua tombol aksi, pemilih status, tautan navigasi, dan tombol penutup pada layar ponsel wajib memiliki area target sentuh minimal **44px x 44px** untuk menjamin kemudahan penggunaan pada perangkat Android.

---

## 7. Kerangka Aplikasi dan Resolusi Responsif (Navigation & Responsive Shell)

### 1. Perilaku Berdasarkan Tipe Perangkat
- **Desktop (lebar layar >= 1024px)**:
  - Menggunakan tata letak ruang kerja penuh (full workspace) dengan bilah samping tetap selebar 260px.
  - Memiliki bilah atas melekat (sticky topbar) dengan jam operasional resmi sekolah dan ringkasan profil pengguna.
- **Tablet (lebar layar 768px hingga 1023px)**:
  - Memprioritaskan arsitektur informasi desktop selama ruang masih mencukupi.
  - Jika ruang horizontal mulai sempit, bilah samping bertransisi menjadi menu laci samping (drawer), dan kolom kerja bertumpuk secara proporsional tanpa memaksa tata letak seluler sempit.
- **Ponsel Pintar (lebar layar < 768px)**:
  - **Khusus Siswa**: Dapat menggunakan dok navigasi bawah tetap (Fixed Bottom Navigation) berisi 3 akses utama: Beranda (`/student`), Scan QR (`/student/scan`), dan Riwayat (`/attendance/history`).
  - **Guru dan Administrator**: Tetap mempertahankan kerangka kerja responsif yang ada (bilah atas ringkas tinggi 56px dengan tombol hamburger dan panel menu laci samping `mobile-nav-drawer`), tanpa menambahkan sistem navigasi bawah baru.

### 2. Struktur Bilah Samping Desktop (Desktop Sidebar)
- **Lebar Tetap**: 260px, posisi menempel di sisi kiri (`fixed` atau `sticky`), latar putih murni dengan garis pemisah kanan `1px solid #e2e8f0`.
- **Header Merek**: Logo resmi SMAN 2 Cimalaka (`logo-color.png`, tinggi 36px), nama sekolah "SMAN 2 Cimalaka", dan teks "Sistem Presensi".
- **Pengelompokan Menu Sesuai Peran**:
  - **Administrator**:
    - *Navigasi Utama*: Administrasi Sekolah (`/admin`), QR Presensi Sekolah (`/admin/attendance-qr`), Riwayat Presensi Global (`/attendance/history`), Ubah Kata Sandi (`/change-password`).
    - *Kelompok Manajemen Data*: Data & Akun Siswa (`/admin/students`), Kelola Data Guru (`/admin/teachers`).
    - *Kelompok Operasional Khusus*: Impor Roster Siswa (`/admin/students/import`), Aktivasi Massal Siswa (`/admin/students/activation-bulk`), Pengaturan Jam Presensi (`/admin/attendance-settings`), Koreksi Presensi Siswa (`/admin/attendance-corrections`).
    - *Catatan Phase 3*: Dasbor operasional Ringkasan Administrator akan dirancang pada Phase 3.
  - **Guru**:
    - *Navigasi Utama*: Operasional Guru (`/teacher`), Riwayat Presensi Kelas (`/attendance/history`), Ubah Kata Sandi (`/change-password`), Keluar.
    - *Sesi Presensi*: Layar QR Proyektor (`/teacher/attendance-qr`) diakses langsung melalui tombol aksi operasional pada halaman Presensi Kelas Harian. Guru tidak memiliki destinasi Ringkasan teknis.
  - **Siswa**:
    - *Navigasi Utama*: Beranda (`/student`), Pindai QR (`/student/scan`), Riwayat Kehadiran (`/attendance/history`), Ubah Kata Sandi (`/change-password`), Keluar. Siswa tidak memiliki destinasi Ringkasan teknis.
- **Gaya Tautan Navigasi**:
  - Item standar: Teks `#444653`, padding 10px 14px, radius 8px, ikon Material Symbols 20px.
  - Item aktif: Latar belakang biru langit lembut (`#e0f2fe`), teks biru akademis (`#1e40af`, font-weight 600), dan garis aksen vertikal kiri 3px berwarna `#1e40af`.
- **Footer Profil**: Nama lengkap pengguna, nomor identitas resmi (NIS untuk siswa, ID untuk guru dan admin), chip peran resmi, tautan Ubah Kata Sandi (`/change-password`), dan tombol aksi Keluar (`Keluar`).

---

## 8. Pola Komponen Bersama (Shared UI Patterns)

### 1. Header Halaman (Page Header)
- **Kategori Konteks (Eyebrow)**: Teks huruf kapital 11px tebal (`letter-spacing: 0.04em`), warna biru akademis (`#1e40af`).
- **Judul Halaman (H1)**: Manrope 24px Bold, warna `#0d1c2e`.
- **Deskripsi Operasional**: 1 kalimat penjelas fungsi halaman (Manrope 14px, warna `#444653`).
- **Toolbar Aksi**: Sisi kanan atas pada desktop (misalnya tombol "Tambah Siswa Baru", "Segarkan Data", atau "Unduh Laporan").

### 2. Tombol Aksi (Action Buttons)
- **Tombol Utama (`button-primary`)**:
  - Latar: `#1e40af`, teks: `#ffffff`. Hover: `#1d4ed8`, active: scale 0.99 dan `#1e3a8a`.
  - Tinggi 40px (desktop), 44px hingga 48px (ponsel). Radius sudut 8px.
  - Digunakan untuk satu aksi primer per bagian (contoh: Masuk, Simpan Perubahan, Mulai Kamera, Unduh Slip PDF).
- **Tombol Sekunder (`button-secondary`)**:
  - Latar: `#ffffff`, garis batas: `1px solid #cbd5e1`, teks: `#0d1c2e`. Hover: `#eff4ff`.
  - Digunakan untuk aksi filter, tombol kembali, salin kode, dan batal non-destruktif.
- **Tombol Bahaya (`button-danger`)**:
  - Latar: `#dc2626`, teks: `#ffffff`. Hover: `#b91c1c`.
  - Digunakan khusus untuk aksi penonaktifan akun, reset massal kode, atau pembatalan sesi.
- **Tombol Tenang (`button-quiet`)**:
  - Latar transparan, teks `#444653`, hover teks `#1e40af`. Digunakan untuk tombol keluar (logout) atau pembersihan filter pencarian.

### 3. Bidang Formulir dan Input (Form Controls)
- Tinggi input standar: 42px di desktop, 44px di ponsel. Radius sudut 8px, garis batas `1px solid #cbd5e1`, latar belakang `#ffffff` atau `#eff4ff`.
- Transisi status fokus: Garis batas berubah menjadi `#2563eb` dengan cincin fokus jelas.
- Ikon pembantu di sisi kiri (`left-3.5`) dengan warna muted `#757684`.
- Tombol aksi di sisi kanan (seperti intip kata sandi) memiliki area sentuh minimum 36px.
- Pesan galat validasi: Teks merah `#b91c1c` ukuran 12px tepat di bawah input terkait.

### 4. Tabel Data Bersih (Data Table Pattern)
- **Wadah Tabel**: Memiliki latar putih, radius sudut 12px, dan garis batas luar tipis `1px solid #e2e8f0`.
- **Baris Header (`thead`)**: Latar belakang abu-abu sejuk (`#f8fafc`), teks huruf kapital 12px semibold, tinggi 44px.
- **Baris Data (`tbody tr`)**: Tinggi minimal 52px, garis pemisah bawah 1px netral, efek hover halus `#f1f5f9`.
- **Perataan Data**: Teks rata kiri, angka tanggal/jam rata kiri dengan angka tabular, kolom aksi rata kanan.
- **Paginasi Terpadu**:
  - Khusus tabel siswa admin: Wajib menampilkan 25 siswa per halaman sesuai konfigurasi nyata basis data.
  - Informasi pencacah: Contoh format "Menampilkan 1 - 25 dari 676 siswa".
  - Tombol navigasi paginasi: Awal, Sebelumnya, nomor halaman aktif, Berikutnya, Akhir.
- **Transformasi Seluler**: Pada layar di bawah 768px, baris data bertransisi menjadi kartu baris terstruktur agar mudah dibaca di ponsel.

### 5. Dialog Konfirmasi Kustom (Custom ConfirmDialog)
Seluruh aksi destruktif atau penting (penonaktifan akun, reset kata sandi, penutupan sesi QR kelas, dan pembuatan ulang slip kode aktivasi) **wajib menggunakan komponen modal dialog kustom aplikasi**, dilarang menggunakan fungsi bawaan peramban `window.confirm()`.
- **Aksesibilitas Wajib**:
  - Menggunakan atribut ARIA `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, dan `aria-describedby`.
  - Tombol **Batal** menerima fokus awal secara otomatis saat dialog terbuka untuk mencegah eksekusi aksi bahaya secara tidak sengaja melalui penekanan tombol Enter.
  - Mendukung penutupan melalui penekanan tombol Escape dan klik area latar redup (backdrop).
  - Mengunci scroll latar belakang halaman selama dialog aktif.
  - Mengembalikan fokus keyboard ke tombol pemanggil saat dialog ditutup.
- **Tata Letak Seluler**: Pada layar ponsel, tombol aksi tersusun vertikal terbalik (tombol bahaya di atas, tombol batal di bawah) dengan lebar penuh 100% dan tinggi minimal 44px.

### 6. Laci Samping dan Modal Formulir (Drawers & Modals)
- Pengubahan data terinci (seperti modal Reset Kata Sandi Siswa, modal Tambah Guru Baru, dan formulir Koreksi Presensi) dibuka dalam modal terpusat atau panel laci samping (slide-over drawer), bukan menggunakan baris akordeon `<details>` yang merusak struktur tabel data.

### 7. Status Pemuatan, Data Kosong, dan Umpan Balik
- **Kerangka Pemuatan (Skeleton)**: Menggunakan blok abu-abu netral dengan dimensi yang menyerupai komponen akhir untuk menghindari pergeseran tata letak kumulatif (CLS).
- **Kondisi Kosong (Empty State)**: Menjelaskan dengan bahasa santun mengapa data belum muncul dan menyediakan tombol aksi perbaikan.
- **Umpan Balik Audit Otomatis**: Setiap perubahan presensi atau status akun yang menyimpan catatan audit otomatis menampilkan ringkasan catatan tersebut pada banner notifikasi keberhasilan.

---

## 9. Spesifikasi Pengalaman Autentikasi (Authentication Experience)

### 1. Halaman Masuk Tunggal (`/login`)
- **Tujuan**: Gerbang autentikasi resmi satu pintu bagi Siswa, Guru, dan Administrator.
- **Tata Letak Target**:
  - Kontainer kartu terpusat (`max-w-[480px]`) di tengah layar desktop.
  - Latar belakang kanvas memiliki pola kisi akademis tipis (SVG grid 48x48) dengan rona biru lembut.
- **Elemen Antarmuka**:
  - Logo resmi SMAN 2 Cimalaka (`logo-color.png`, tinggi 60px).
  - Lencana instansi: "Pemerintah Daerah Provinsi Jawa Barat".
  - Judul H1: "SMAN 2 Cimalaka" dan subjudul "Sistem Presensi Digital Terpadu".
  - Kontainer kartu login (`rounded-xl bg-surface-card p-6 sm:p-8 shadow-xl`).
  - **Tab Pemilih Peran Visual (`roleTabs`)**:
    - Kontrol tersegmentasi 2 tab yang tampak publik: `Siswa` dan `Guru`.
    - Mengubah label dan placeholder secara otomatis:
      - Siswa: "Nomor Induk Siswa (NIS)" (placeholder: "Masukkan nomor induk siswa...").
      - Guru: "ID Masuk Guru" (placeholder: "Masukkan ID resmi guru...").
    - **Dukungan Masuk Administrator**: Opsi peran "Admin" sengaja tidak ditampilkan sebagai tab publik demi kerapian dan kesederhanaan visual antarmuka publik. Namun, akun Administrator yang sah tetap dapat masuk secara normal melalui formulir login yang sama dengan memasukkan ID admin dan kata sandinya. Sistem autentikasi server memverifikasi identitas dan peran akun secara langsung dari basis data tanpa memerlukan pemilih peran khusus Admin.
  - Kolom Kata Sandi dengan tombol intip visibilitas kata sandi.
  - **Petunjuk Bantuan Kata Sandi**: Teks bantuan statis di bawah kolom sandi: "Lupa kata sandi? Siswa dapat menghubungi Wali Kelas atau Guru BK di sekolah. Guru dan Admin dapat menghubungi Bagian Tata Usaha." Tidak memerlukan dialog modal terpisah atau pemulihan otomatis via SMS/WhatsApp.
  - **Tanpa Fitur Ingat Saya Non-Fungsional**: Tidak menampilkan checkbox ingat saya karena mekanisme sesi aplikasi telah dikelola secara aman melalui cookie sesi terotentikasi, sehingga tidak menyajikan elemen semu tanpa fungsi riil.
  - Tombol utama "Masuk ke Sistem" dengan ikon panah maju dan animasi putar saat proses verifikasi berjalan.
  - **Rak Bawah Kartu (Callout Aktivasi Siswa Baru)**:
    - Kontainer abu-abu kebiruan di bagian bawah kartu: "Siswa baru atau belum punya kata sandi? Gunakan NIS aktif Anda untuk langkah awal" disertai tautan "Aktivasi Akun" menuju `/activate`.
  - Footer atribusi: Tanda keamanan terverifikasi sekolah, alamat resmi Jalan Tanjungkerta No. 34 Cimalaka, dan tahun hak cipta.

### 2. Halaman Aktivasi Akun Siswa Mandiri (`/activate`)
- **Tujuan**: Alur aktivasi perdana bagi siswa terdaftar menggunakan NIS dan slip kode aktivasi fisik 8-karakter dari sekolah.
- **Tata Letak Target**:
  - Kartu terpusat (`max-w-[540px]`) pada kanvas tenang.
- **Elemen Antarmuka**:
  - Logo resmi SMAN 2 Cimalaka dan judul H1 "Aktivasi Akun Siswa Mandiri".
  - Subjudul pengantar: "Masukkan NIS dan Kode Aktivasi 8-karakter yang tercantum pada slip aktivasi dari wali kelas."
  - **Bidang Input Terpandu**:
    1. **Nomor Induk Siswa (NIS)**: Input teks numerik dengan ikon kartu identitas.
    2. **Kode Aktivasi Tersegmentasi (`[XXXX] - [XXXX]`)**:
       - Dua kotak input berkapasitas masing-masing 4 karakter yang dipisahkan tanda pemisah strip.
       - Teks berhuruf kapital otomatis, font monospace tebal (JetBrains Mono / font-mono), dan lompat fokus otomatis ke kotak kedua setelah 4 karakter terisi.
    3. **Kata Sandi Baru** dan **Konfirmasi Kata Sandi Baru** dengan tombol intip kata sandi.
  - **Kartu Checklist Syarat Kata Sandi Nyata**:
    - Memuat 4 aturan validasi riil aplikasi yang ikonnya berubah menjadi tanda centang hijau secara dinamis saat kriteria terpenuhi:
      1. Minimal 10 karakter.
      2. Memuat kombinasi huruf dan angka.
      3. Tidak sama dengan NIS / ID login siswa.
      4. Konfirmasi kata sandi cocok.
  - Tombol utama "Aktifkan Akun Saya" dengan ikon registrasi.
  - Tautan sekunder "Kembali ke Halaman Masuk" (`/login`).
  - Panel bantuan jika slip kode aktivasi hilang atau kedaluwarsa.

### 3. Halaman Ubah Kata Sandi (`/change-password`)
- **Tujuan**: Pembaruan kata sandi mandiri pengguna aktif.
- **Tata Letak**: Kartu terpusat (`max-w-[480px]`) dengan daftar identitas akun aktif, input kata sandi saat ini, input kata sandi baru beserta konfirmasi, dan checklist validasi kata sandi.

### 4. Halaman Akses Ditolak (`/forbidden`)
- **Tujuan**: Menampilkan informasi edukatif jika pengguna mencoba membuka tautan yang melampaui hak akses perannya.
- **Tata Letak**: Tampilan tenang terpusat dengan ikon perlindungan, penjelasan ramah, dan tombol kembali ke halaman beranda yang sesuai hak akses pengguna.

---

## 10. Spesifikasi Pengalaman Siswa (Student Experience)

### 1. Beranda Presensi Siswa (`/student`)
- **Pendekatan**: Desain mobile-first yang dioptimalkan untuk perangkat Android dan tampilan ponsel pintar 360px hingga 412px.
- **Struktur Halaman**:
  1. **Kartu Salam dan Profil Siswa**:
     - Menampilkan salam waktu ("Selamat Pagi / Siang"), nama lengkap siswa, NIS, kelas rombongan belajar (contoh: "XI MIPA 2"), dan lencana status akun "Aktif".
  2. **Kartu Pahlawan Presensi Hari Ini (Hero Attendance Card)**:
     - Jam digital lokal berjalan dan tanggal hari ini (contoh: "06:48 WIB").
     - Informasi jendela jadwal masuk (contoh: "Jam Masuk: 06:30 - 07:15 WIB").
     - Status presensi siswa hari ini dalam lencana semantik besar (Hadir Tepat Waktu, Terlambat, Izin, Sakit, atau Belum Presensi).
     - **Tombol Aksi Utama Mencolok**: Tombol besar berkontras tinggi "Scan QR Presensi Sekarang" dengan ikon `qr_code_scanner` berukuran besar yang langsung membuka rute `/student/scan`.
  3. **Strip Aktivitas Mingguan (Weekly Tracker)**:
     - Tampilan horizontal Senin hingga Jumat dengan indikator jam presensi dan lencana status harian siswa.
     - Tautan "Lihat Riwayat Lengkap" menuju `/attendance/history`.
  4. **Ringkasan Kehadiran Semester**:
     - Kartu statistik bersih: Total Hari Hadir, Persentase Kehadiran Resmi, dan rincian jumlah Hadir, Terlambat, Izin, Sakit, Alfa.

### 2. Pemindai QR Siswa (`/student/scan`)
- **Pengalaman Utama Kamera Ponsel**:
  - Tampilan jendela bidik kamera (camera viewfinder) penuh yang memprioritaskan umpan video langsung.
  - Bingkai bidik persegi di tengah layar dengan garis sudut kontras tinggi dan garis panduan pemindaian.
  - Bilah atas mengambang berisi tombol kembali ke beranda, teks judul "Pindai QR Presensi", dan lencana sesi jadwal aktif.
  - Tombol sentuh pengatur lampu senter kamera (flash toggle) dan tombol pembalik kamera (flip camera).
- **Status dan Interaksi**:
  - **Kondisi Sukses Memindai**: Menampilkan modal lembar bawah (bottom sheet) dengan ikon centang sukses hijau, judul "Presensi Berhasil Dicatat!", cap waktu resmi server sekolah (WIB), lokasi/sesi kelas, status kehadiran yang diperoleh, dan tombol kembali ke beranda.
  - **Kondisi Kode Kedaluwarsa**: Pesan peringatan merah yang menginstruksikan siswa untuk memindai kode QR terbaru pada layar proyektor guru karena sesi 5 menit telah berganti.
  - **Petunjuk Operasional**: Kotak panduan ringkas di bagian bawah agar siswa menjaga jarak pemindaian 30 hingga 50 cm dan tidak menggunakan foto tangkapan layar.

### 3. Riwayat Presensi Saya (`/attendance/history`)
- Filter bulan dan tahun presensi.
- Daftar riwayat kehadiran harian dengan kartu baris yang rapi: Tanggal, lencana status kehadiran, jam masuk tercatat, jam pulang tercatat, dan metode pencatatan ("Scan QR Mandiri" atau "Dicatat Guru").
- Tombol aksi unduh berkas rekapitulasi kehadiran format PDF.

---

## 11. Spesifikasi Pengalaman Guru (Teacher Experience)

### 1. Dasbor Presensi Kelas Harian (`/teacher`)
- **Tujuan**: Alat operasional guru di dalam ruang kelas untuk memantau kehadiran siswa secara langsung dan melakukan koreksi absensi manual tanpa hambatan.
- **Struktur Halaman**:
  - **Header Operasional**:
    - Ucapan salam personal: "Selamat pagi, Bpk./Ibu [Nama Guru]".
    - Rincian kelas aktif: Pemilih kelas (dropdown kelas yang memuat daftar rombel riil dari sistem) dan tombol aksi cepat "Buka QR Bersama".
  - **Ringkasan Statistik Kelas Real-time**:
    - 4 kartu metrik ringkas: Hadir Tepat, Terlambat, Izin/Sakit, Belum Presensi (sesuai ringkasan kelas terpilih dari basis data).
  - **Toolbar Filter Roster**:
    - Tab filter cepat: "Semua", "Hadir", "Terlambat", "Izin/Sakit", "Belum Absen".
    - Kolom pencarian instan nama atau NIS siswa.
  - **Daftar Presensi Roster Kelas**:
    - Setiap baris siswa memuat: Avatar inisial nama, nama lengkap siswa, NIS, cap waktu deteksi presensi jika sudah memindai.
    - **Pemilih Status Dropdown Terpadu**: Satu tombol status terpadu yang menampilkan warna status saat ini dan membuka menu pilihan (Hadir Tepat, Terlambat, Izin, Sakit, Dispensasi, Alfa).
    - **Kolom Catatan Guru**: Bidang input teks satu baris per siswa untuk mencatat alasan keterlambatan atau catatan medis ringan (contoh: "Rantai sepeda putus", "Istirahat di ruang UKS"). Catatan tersimpan secara langsung ke sistem.

### 2. Penayangan Layar QR Bersama di Proyektor (`/teacher/attendance-qr` dan `/admin/attendance-qr`)
- **Orientasi Layar Lebar**: Dirancang khusus untuk ditampilkan pada proyektor kelas atau televisi pintar sekolah dengan tata letak bersih berorientasi 16:9 atau 16:10.
- **Header Visibilitas Tinggi**:
  - Lambang resmi SMAN 2 Cimalaka, teks "Layar Monitor Proyektor Presensi", jam digital lokal dengan format detik ("07:12:00 WIB"), dan indikator "Sesi Presensi Sekolah".
- **Kartu Utama Kode QR Dinamis**:
  - Tampilan gambar QR presensi berukuran besar di atas kartu putih murni berlatar kontras tinggi.
  - **Indikator Rotasi QR 5 Menit (300 Detik)**:
    - Garis progres hitung mundur visual dan teks penjelas: "Kode QR diperbarui otomatis setiap 5 menit (pukul XX:XX WIB) demi keamanan presensi kelas."
    - Sesi QR berotasi setiap **5 menit (300 detik)** mengikuti aturan kriptografi HMAC server yang telah berjalan.
  - Instruksi singkat bagi siswa yang memasuki kelas.
- **Papan Metrik Sesi di Bawah QR**:
  - Menampilkan waktu pembuatan QR dan waktu pergantian QR berikutnya dalam format WIB.
- **Bilah Kontrol Sesi**:
  - Tombol aksi: "Mulai Sesi QR" dan "Hentikan Sesi" (menggunakan komponen konfirmasi kustom `ConfirmDialog`).
  - Dukungan tombol layar penuh (Fullscreen) berbasis browser API standar (`requestFullscreen()`).
  - **Pengecualian**: Tombol cetak layar darurat (emergency screen-print button) **tidak disertakan** pada spesifikasi target ini.
  - Tidak memperkenalkan fungsionalitas server/jaringan fiktif, indikator koneksi Wi-Fi tiruan, atau websocket streaming palsu.

---

## 12. Spesifikasi Pengalaman Administrator (Admin Experience)

### 1. Dasbor Utama Administrator (`/admin`)
- **Ruang Kerja Terpadu**:
  - Ringkasan data nyata sekolah: Total Siswa Terdaftar (**676 siswa riil**), Total Guru Aktif, dan Status Sesi QR Sekolah Saat Ini.
  - Kartu navigasi operasional yang terstruktur:
    - **Pengaturan Jam Presensi**: Jam masuk, toleransi keterlambatan, dan jam kepulangan sekolah.
    - **Koreksi Presensi**: Perbaikan catatan kehadiran dengan rekaman audit log otomatis.
    - **Riwayat dan Laporan**: Unduh rekapitulasi kehadiran resmi format PDF.
    - **QR Presensi Siswa**: Kontrol sesi penayangan QR presensi sekolah.
    - **Kelola Data Siswa**: Roster 676 siswa, aktivasi akun, dan reset sandi.
    - **Pengelolaan Guru**: Manajemen akun guru dan penugasan akses.

### 2. Kelola Data Siswa (`/admin/students`)
- **Sumber Data Nyata**: Mengelola dataset riil sebanyak **676 siswa** SMAN 2 Cimalaka.
- **Paginasi Wajib**: Tabel menggunakan paginasi server tepat **25 siswa per halaman** ("Menampilkan 1 - 25 dari 676 siswa").
- **Struktur Toolbar**:
  - Pencarian teks terpadu untuk Nama atau NIS.
  - Dropdown filter kelas rombel dan filter status akun (Semua, Aktif, Menunggu Aktivasi, Terkunci).
  - Tombol aksi sekunder "Ekspor Data" dan tombol aksi primer "+ Tambah Siswa Baru".
- **Kolom Tabel Data Siswa**:
  1. **Siswa**: Lingkaran avatar inisial, nama lengkap siswa, NIS, dan NISN.
  2. **Kelas & Jurusan**: Label rombel (contoh: "X-1", "XI MIPA 2").
  3. **Status Akun**: Lencana status (Aktif, Menunggu Aktivasi, Terkunci).
  4. **Status Aktivasi**: Keterangan kesiapan kode aktivasi siswa.
  5. **Aksi Baris**:
     - Tombol cepat "Reset Sandi" (membuka modal Reset Kata Sandi).
     - Tombol cepat "Kode Akses" (menuju halaman aktivasi individu).
     - Tombol pengalih "Nonaktifkan" / "Aktifkan" (wajib memicu `ConfirmDialog`).
- **Modal Reset Kata Sandi Siswa**:
  - Dialog terpusat yang menampilkan profil siswa terpilih.
  - Pilihan mode reset: Buat kata sandi sementara acak atau buat kode aktivasi mandiri baru.
  - Tombol sekali klik "Salin Kata Sandi" ke papan klip.
  - Tombol konfirmasi "Simpan & Salin".

### 3. Impor Roster Siswa (`/admin/students/import`)
- Mempertahankan alur kerja 4 langkah yang teruji:
  1. **Langkah 1 (Unggah File Excel)**: Zona drag-and-drop berkas `.xlsx` dengan petunjuk format kolom yang didukung.
  2. **Langkah 2 (Pemetaan Kolom)**: Deteksi otomatis lembar kerja (multi-sheet rombel) serta dropdown pemetaan kolom NIS, Nama Lengkap, dan Kelas.
  3. **Langkah 3 (Pratinjau dan Validasi)**: Validasi data duplikat, deteksi galat pemblokir, ringkasan jumlah baris valid, dan tabel pratinjau.
  4. **Langkah 4 (Selesai)**: Ringkasan hasil impor data siswa yang berhasil disimpan ke sistem.

### 4. Aktivasi Massal dan Cetak Slip Siswa (`/admin/students/activation-bulk`)
- **Kartu Statistik Aktivasi**: Total Siswa (676), Akun Sudah Aktif, Memiliki Kode Aktif, Belum Memiliki Kode.
- **Panel Generator Kode**:
  - Pemilih lingkup generasi: Seluruh sekolah atau rombongan belajar tertentu.
  - Opsi strategi kode: "Hanya untuk siswa yang belum memiliki kode" atau "Buat ulang seluruh kode aktivasi (reset)".
  - Peringatan tegas bahwa pembuatan ulang kode membatalkan slip lama yang belum digunakan.
- **Tabel Unduh Slip PDF**:
  - Daftar kelas rombel dengan informasi jumlah siswa dan tombol unduh slip PDF cetak format A4 Portrait siap potong (`student-activation-pdf.ts`). Menggunakan logo hitam-putih resmi `public/logo/logo-bw.png`.

### 5. Aktivasi Siswa Individu (`/admin/students/[loginId]/activation`)
- Menampilkan kartu identitas siswa (NIS, Nama, Kelas).
- Penampil kode aktivasi tunggal dengan format tegas `XXXX-XXXX`.
- Tombol salin kode, indikator masa berlaku kode aktivasi, dan tombol buat ulang kode dengan modal konfirmasi.

### 6. Kelola Data Guru (`/admin/teachers`)
- Tabel direktori guru: NIP / ID Masuk, Nama Lengkap, Tanggal Terdaftar, Status Akun, dan Aksi.
- Tombol header "+ Tambah Guru Baru" yang membuka modal input guru.
- Aksi baris: Reset kata sandi guru melalui modal dan tombol pengaktifan akun dengan `ConfirmDialog`.

### 7. Pengaturan Jam Presensi (`/admin/attendance-settings`)
- **Garis Waktu Visual Kebijakan (Visual Timeline Bar)**:
  - Menyajikan jadwal harian sekolah dalam diagram garis waktu horizontal:
    - `06:00 - 06:30`: Persiapan gerbang sekolah.
    - `06:30 - 07:15`: Jam kedatangan normal (Hadir Tepat Waktu).
    - `07:16 - 07:45`: Batas toleransi keterlambatan (Tercatat Terlambat).
    - `07:46 - 15:00`: Jam Kegiatan Belajar Mengajar (Gerbang masuk ditutup).
    - `15:00 - 17:00`: Jam presensi kepulangan sekolah.
- **Formulir Pengaturan Waktu**:
  - Input jam masuk normal, jam toleransi, dan jam pulang (menggunakan tipe input `time` standar).
  - Pengaturan jadwal khusus hari Jumat (jam kepulangan pukul 11:30 WIB sebelum sholat Jumat).
  - Tombol aksi: "Pulihkan Default" dan "Simpan Perubahan Jadwal".
  - Dilarang menambahkan opsi GPS, geofencing, atau radius lokasi buatan.

### 8. Koreksi Presensi Siswa (`/admin/attendance-corrections`)
- **Tata Letak Desktop**:
  - Mengadopsi pola master-detail dua kolom Stitch:
    - **Sisi Kiri (Master List)**: Panel pencarian (tanggal, kelas, nama/NIS) dan daftar kartu siswa yang ditemukan.
    - **Sisi Kanan (Detail Panel)**: Formulir koreksi presensi yang aktif saat catatan siswa dipilih melalui parameter URL `record`.
- **Tata Letak Responsif (Tablet & Ponsel)**:
  - Pada layar tablet atau ponsel, transisi master-detail berlangsung secara responsif tanpa mengubah logika URL parameter: saat catatan dipilih, formulir koreksi tampil bertumpuk di bawah daftar atau terbuka melalui panel laci samping (slide-over drawer).
- **Formulir Koreksi Presensi**:
  - Informasi catatan presensi saat ini (status, jam masuk, jam pulang).
  - Pilihan status kehadiran baru melalui radio pill (Hadir, Terlambat, Sakit, Izin, Dispensasi, Alfa).
  - Input jam masuk aktual (format WIB).
  - Pilihan kategori alasan koreksi (Surat Dokter, Dispensasi Dinas/OSIS, Kendala Teknis, Lainnya) dan catatan teks verifikasi.
  - Tombol simpan koreksi dengan **pencatatan audit otomatis** (merekam ID pengubah, cap waktu, dan alasan koreksi ke dalam log audit sistem).

---

## 13. Operasional dan Siklus Presensi (Attendance Operations)

1. **Siklus Rotasi QR Dinamis 5 Menit**:
   - Kode QR presensi sesi sekolah diperbarui secara otomatis setiap **5 menit (300 detik)**.
   - Perangkat pemindai siswa memvalidasi token yang dihasilkan server. Kode kedaluwarsa ditolak dengan arahan memindai ulang kode terbaru di layar proyektor guru.
2. **Aturan Status Kehadiran Otomatis**:
   - Pemindaian pukul 06:30 hingga 07:15 WIB menghasilkan status **Hadir**.
   - Pemindaian pukul 07:16 hingga 07:45 WIB menghasilkan status **Terlambat**.
   - Siswa yang tidak memindai QR hingga batas waktu dan tidak memiliki surat izin ditandai sebagai **Alfa / Belum Ditandai**.
3. **Integritas Audit Log**:
   - Setiap koreksi manual yang dilakukan oleh guru atau administrator merekam identitas pengubah dan alasan perubahan secara otomatis ke tabel riwayat audit presensi.

---

## 14. Standar Responsivitas dan Perilaku Perangkat (Device Responsive Guidelines)

- **Desktop (>= 1024px)**:
  - Ruang kerja penuh dengan bilah samping tetap 260px, bilah atas melekat, dan lebar maksimal 1440px.
- **Tablet (768px hingga 1023px)**:
  - Mempertahankan arsitektur desktop jika ruang mencukupi. Bila sempit, bilah samping beralih ke panel laci samping (drawer), dan kolom data bertumpuk secara proporsional.
- **Ponsel Pintar (< 768px)**:
  - **Siswa**: Dapat menggunakan dok navigasi bawah tetap (Fixed Bottom Navigation) untuk Beranda, Scan QR, dan Riwayat.
  - **Guru dan Admin**: Menggunakan bilah atas ringkas (tinggi 56px) dengan tombol hamburger yang membuka panel menu laci samping (slide-over drawer) yang sudah ada di aplikasi.
  - Seluruh tombol utama memiliki lebar penuh (100%) dengan tinggi minimal 44px hingga 48px.
  - Input numerik menggunakan konfigurasi `inputMode="numeric"` untuk memicu papan ketik angka secara instan.
- **Layar Proyektor / TV (16:9 dan 16:10)**:
  - Khusus halaman penayangan QR proyektor, tata letak mengoptimalkan pembesaran kode QR dan keterbacaan metrik dari jarak 5 hingga 10 meter di dalam ruang kelas.

---

## 15. Aksesibilitas (Accessibility Standards)

1. **Rasio Kontras Keterbacaan (WCAG AA)**:
   - Seluruh teks utama terhadap latar belakang wajib memiliki rasio kontras minimal **4.5:1**. Teks judul tebal minimal **3:1**.
2. **Navigasi Papan Ketik dan Indikator Fokus**:
   - Seluruh kontrol interaktif (tombol, input, dropdown, link) memiliki cincin fokus yang tegas: outline 2px solid `#2563eb` dengan offset 1px.
   - Tersedia tautan loncat navigasi (`Skip to main content` / `Lewati ke konten utama`) tersembunyi bagi pengguna pembaca layar.
3. **Kemandirian Terhadap Warna**:
   - Status presensi tidak boleh hanya mengandalkan warna latar atau lingkaran warna. Wajib disertai teks eksplisit (contoh: "HADIR", "TERLAMBAT", "IZIN") dan ikon pendukung.
4. **Pengelolaan Fokus Dialog Modal**:
   - Dialog mengunci fokus (focus trap) di dalam jendela modal selama aktif.
   - Penekanan tombol Escape menutup modal dan mengembalikan fokus ke elemen pembuka sebelumnya.
5. **Semantik Elemen HTML5**:
   - Menggunakan tag `<header>`, `<nav>`, `<aside>`, `<main>`, `<section>`, `<table>`, dan `<dialog>` secara tepat tanpa pembungkus `div` berlebihan.

---

## 16. Tata Bahasa dan Kamus Salinan Antarmuka (Indonesian UI Copy Rules)

Antarmuka pengguna wajib menggunakan **Bahasa Indonesia resmi, lugas, dan santun** yang lazim digunakan di lingkungan pendidikan menengah atas.

### Kamus Istilah Baku
- Gunakan `Siswa`, bukan `Murid` atau `User`.
- Gunakan `Guru`, bukan `Pengajar` atau `Teacher`.
- Gunakan `Administrator` atau `Admin`, bukan `Superuser`.
- Gunakan `Presensi`, bukan `Absensi` saat merujuk pencatatan kehadiran.
- Gunakan `Scan QR Presensi` atau `Pindai QR`, bukan `Barcode Scanner`.
- Gunakan `Kode Aktivasi`, bukan `Voucher` atau `Token`.
- Gunakan `Rombel` atau `Kelas`, bukan `Group` atau `Cohort`.
- Gunakan `WIB`, bukan `Waktu Lokal` atau `UTC`.
- Gunakan `Tepat Waktu`, `Terlambat`, `Izin`, `Sakit`, `Dispensasi`, dan `Alfa`.

### Larangan Istilah Teknis Internal (Internal Jargon Prohibition)
Dilarang menampilkan istilah arsitektur teknis atau database backend kepada pengguna:

| Istilah Terlarang | Pengganti Ramah Pengguna |
| :--- | :--- |
| `PostgreSQL menentukan rotasi...` | `Kode QR diperbarui otomatis setiap 5 menit.` |
| `Supabase Auth sesi kedaluwarsa...` | `Sesi masuk Anda telah berakhir demi keamanan. Silakan masuk kembali.` |
| `Data snapshot terkirim...` | `Catatan presensi berhasil disimpan.` |
| `Validasi HMAC Digest gagal...` | `Kode QR tidak valid atau telah kedaluwarsa. Silakan pindai kode terbaru.` |
| `Tabel people kolom nis...` | `Nomor Induk Siswa (NIS).` |
| `Operasi transaksional basis data...` | `Data siswa langsung disimpan ke sistem sekolah.` |
| `Row-Level Security (RLS) ditolak...` | `Anda tidak memiliki hak akses untuk membuka halaman ini.` |

### Prinsip Arsitektur Informasi dan Konten Pengguna (Final Phase 2 IA Decision)
1. **Detail Implementasi Bukan Konten Produk**: Detail teknis internal seperti Supabase Auth, PostgreSQL, transaksi basis data, tabel people, otorisasi server, dan arsitektur basis data internal bukan konten produk yang disajikan ke pengguna akhir.
2. **Navigasi Siswa**: Siswa tidak memiliki destinasi navigasi Ringkasan. Navigasi siswa berfokus pada tugas nyata: Beranda, Pindai QR, Riwayat, Ubah Kata Sandi, dan Keluar.
3. **Navigasi Guru**: Guru tidak memiliki destinasi navigasi Ringkasan ketika halaman tersebut hanya memuat informasi implementasi teknis. Navigasi guru berfokus pada: Operasional Guru, Riwayat Presensi, Ubah Kata Sandi, dan Keluar.
4. **Dasbor Administrator**: Dasbor operasional Ringkasan Administrator akan dirancang pada Phase 3.
5. **Fokus Operasional**: Halaman operasional wajib menyajikan informasi yang relevan bagi pengguna saja. Dilarang memaparkan detail implementasi Supabase, PostgreSQL, basis data, atau otorisasi server dalam alur kerja normal Siswa dan Guru.

---

## 17. Batasan Implementasi (Implementation Boundaries)

Dokumen ini merupakan panduan antarmuka pengguna (UI) dan pengalaman pengguna (UX) untuk rekonstruksi tampilan visual:
1. **Tidak Mengubah Logika Fungsional dan Rute**: Seluruh rute Next.js yang ada (`/login`, `/activate`, `/change-password`, `/dashboard`, `/admin`, `/teacher`, `/student`, dll.) dipertahankan strukturnya.
2. **Tidak Mengubah Skema Basis Data**: Tidak ada perubahan tabel, kolom, tipe data, migrasi Supabase, atau kebijakan keamanan baris (RLS).
3. **Tidak Mengubah Logika Bisnis dan Kriptografi**:
   - Format kode aktivasi tetap 8 karakter dengan presentasi `XXXX-XXXX`.
   - Penyimpanan hash digest HMAC, rotasi sesi QR 5 menit (300 detik), dan validasi waktu presensi tetap berjalan menggunakan pustaka yang sudah ada.
   - Skema peran pengguna tetap 3 peran: `Siswa`, `Guru`, dan `Admin`.
   - Dataset nyata sekolah tetap **676 siswa** dengan pembagian 25 siswa per halaman pada modul admin.
   - Rekaman catatan audit otomatis pada koreksi presensi tetap dipertahankan.
4. **Tujuan Akhir**: Menghadirkan antarmuka sistem presensi yang modern, rapi, tenang, profesional, dan mudah dioperasikan di lapangan tanpa mengorbankan stabilitas fungsional sistem.
