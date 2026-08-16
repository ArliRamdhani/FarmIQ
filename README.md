# FarmIQ 🌾

**FarmIQ** adalah platform asisten kecerdasan buatan terpadu (*AI-Powered Agriculture & Livestock Specialist*) yang dirancang khusus untuk mendampingi petani, peternak, penyuluh pertanian, dan praktisi agribisnis di Indonesia dalam mengambil keputusan budidaya yang presisi, efisien, dan ramah lingkungan.

Didukung oleh **Google Gemini REST API**, FarmIQ mampu memproses teks pertanyaan, rekaman suara langsung (*live voice notes* via mikrofon), serta unggahan foto tanaman/hewan untuk memberikan solusi dan diagnosa real-time di lapangan.

---

## 🌟 Fitur Utama

* **💬 Konsultasi Agronomi & Peternakan:** Rekomendasi formula pemupukan berimbang (NPK/Urea/Organik), jadwal tanam, manajemen irigasi, serta nutrisi pakan ternak.
* **🌱 Panduan Budidaya Pemula & Pekarangan:** Panduan praktis skala rumahan (Sayur Polybag, Cabai Rawit Pot, Jamur Tiram, Ayam Petelur 10–20 ekor, Budikdamber Lele, dan Kelinci).
* **🩺 Diagnosa Kesehatan (Foto & Voice Note):** Deteksi dini patogen tanaman (jamur, bakteri, virus), serangan hama, defisiensi hara, dan patologi kesehatan ternak melalui foto bergejala dan penjelasan suara.
* **📈 Update Harga Pasar Komoditas:** Pantauan harga acuan komoditas pangan harian, proyeksi tren panen, info cuaca agroklimatologi lokal, dan mekanisme subsidi pupuk e-RDKK.
* **🎙️ Rekaman Suara Langsung / Voice Note:** Fitur rekam mikrofon langsung di semua mode layanan (*tanpa repot upload file audio*), dilengkapi penghitung durasi dan pemutar audio pratinjau.
* **🗂️ Ruang Obrolan Terpisah (*Multi-Tab Chat Sessions*):** Setiap mode layanan (*Konsultasi*, *Check Kesehatan*, dan *Update Pasar*) memiliki ruang dan riwayat percakapan independen.
* **💬 Formulir Masukan Pengguna (User Feedback):** Fitur interaktif bagi pengguna untuk memberikan rating (1–5 bintang), kritik, dan saran pengembangan aplikasi yang disimpan aman pada penyimpanan lokal (`data/feedbacks.json`).
* **🔒 Portal Admin Khusus Pengelola (`/admin`):** Dashboard manajemen umpan balik bagi developer/owner yang dilindungi otentikasi token bertanda tangan **HMAC SHA-256**, dilengkapi statistik real-time, filter status, pencarian, tautan cepat WhatsApp, dan ekspor CSV.
* **🌓 Mode Tampilan Gelap & Terang:** Antarmuka modern yang nyaman digunakan baik di bawah terik matahari maupun malam hari.

---

## 🛠️ Tech Stack & Arsitektur

* **Backend:** Node.js, Express.js 5, TypeScript (`strict: true`)
* **AI Engine:** Google Gemini REST API (`generateContent`)
* **Database / Data Store:** Atomic Persistent Storage (`data/feedbacks.json`) dengan caching in-memory
* **Authentication:** HMAC SHA-256 Signed Session Tokens (Masa berlaku 7 hari)
* **File Processing:** Multer (Pengolahan buffer in-memory tanpa penyimpanan lokal ke disk)
* **Frontend:** Single Page HTML5, Tailwind CSS, Vanilla JavaScript, Marked.js, Highlight.js, Font Awesome
* **Security & Production Hardening:**
  - In-memory rate limiting (30 request/menit per IP untuk mencegah abuse & DDoS)
  - Security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`)
  - Sanitasi pesan log (otomatis menyamarkan query parameter `key=GEMINI_API_KEY`)
  - Validasi ketat tipe MIME dan batas ukuran file (maksimal 25MB)
  - Graceful shutdown handler (`SIGTERM` & `SIGINT`)

---

## 📁 Struktur Direktori

```text
FarmIQ/
├── .env                  # Konfigurasi environment & kredensial (diabaikan git)
├── .env.example          # Template konfigurasi environment
├── .gitignore            # Pengaturan file git ignore
├── tsconfig.json         # Konfigurasi TypeScript compiler
├── PROJECT_RULES.md      # Standar dan aturan arsitektur proyek
├── README.md             # Dokumentasi lengkap proyek
├── package.json          # Dependency & build scripts
├── data/                 # Penyimpanan data masukan pengguna (diabaikan git)
│   └── feedbacks.json
├── src/
│   ├── server.ts         # Server backend Express, routing, keamanan & AI
│   └── db.ts             # Data store layer (CRUD Feedback & Statistik)
├── public/
│   ├── index.html        # Frontend dashboard antarmuka pengguna FarmIQ
│   ├── admin.html        # Portal admin pengelola feedback pengguna
│   ├── favicon.ico       # Favicon browser multi-resolusi
│   └── assets/
│       └── images/       # Folder aset visual & logo
│           ├── logo-full.png # Logo horizontal lengkap (Emblem, Nama, Slogan)
│           ├── logo.png      # Logo emblem persegi
│           ├── app-name.png  # Tipografi nama & slogan FarmIQ
│           ├── favicon.png   # Favicon PNG
│           └── favicon.ico   # Favicon ICO
└── dist/                 # Hasil build JavaScript untuk produksi
```

---

## 🚀 Panduan Instalasi & Menjalankan Aplikasi

### 1. Prasyarat
- **Node.js:** Versi 20.x atau lebih baru (disarankan LTS v22+)
- **NPM:** Versi 9.x atau lebih baru
- **Google Gemini API Key:** Dapatkan dari [Google AI Studio](https://aistudio.google.com/)

### 2. Clone Repositori
```bash
git clone https://github.com/ArliRamdhani/FarmIQ.git
cd FarmIQ
```

### 3. Instal Dependensi
```bash
npm install
```

### 4. Konfigurasi Environment (`.env`)
Salin file template `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Buka file `.env` dan sesuaikan parameter konfigurasi:
```env
# Server Configuration
PORT=3000

# Google Gemini API
GEMINI_API_KEY=AIzaSyYourActualApiKeyHere
GEMINI_MODEL=gemini-3.5-flash-lite

# Admin Feedback Portal Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=farmiq2026!
ADMIN_SESSION_SECRET=farmiq_super_secret_session_token_key_2026
```

---

## 💻 Menjalankan Server

### Mode Pengembangan (Development)
Menjalankan server dengan *hot-reloading* via `tsx watch`:
```bash
npm run dev
```
* **Aplikasi Utama:** `http://localhost:3000`
* **Portal Admin:** `http://localhost:3000/admin`

### Mode Produksi (Production Build & Run)
1. Kompilasi TypeScript ke JavaScript murni:
   ```bash
   npm run build
   ```
2. Jalankan server produksi:
   ```bash
   npm start
   ```

---

## 📡 API Reference

### 1. Health Check
* **Method:** `GET`
* **Path:** `/api/health`
* **Response:**
  ```json
  {
    "status": "ok",
    "service": "FarmIQ Backend API",
    "model": "gemini-3.5-flash-lite",
    "multimodal": ["text", "image", "audio"],
    "timestamp": "2026-08-17T01:30:00.000Z"
  }
  ```

### 2. Chat & Analisis Multimodal
* **Method:** `POST`
* **Path:** `/api/chat`
* **Content-Type:** `multipart/form-data`
* **Form Fields:**
  - `prompt` *(string, opsional jika ada file)*: Pertanyaan atau instruksi.
  - `image` *(file, opsional)*: File foto tanaman/hewan (JPEG, PNG, WEBP, HEIC maks 25MB).
  - `audio` *(file, opsional)*: File suara/rekaman mikrofon (MP3, WAV, OGG, WEBM, M4A maks 25MB).
* **Response Sukses (`200 OK`):**
  ```json
  {
    "success": true,
    "reply": "Diagnosa dan rekomendasi lengkap dari FarmIQ...",
    "model": "gemini-3.5-flash-lite",
    "hasImage": true,
    "hasAudio": false,
    "timestamp": "2026-08-17T01:30:00.000Z"
  }
  ```

### 3. Pengiriman Masukan Pengguna (Feedback)
* **Method:** `POST`
* **Path:** `/api/feedback`
* **Content-Type:** `application/json`
* **Request Body:**
  ```json
  {
    "name": "Pak Budi",
    "contact": "081234567890",
    "category": "Saran Fitur",
    "rating": 5,
    "message": "Aplikasi sangat membantu untuk diagnosa penyakit di lahan."
  }
  ```
* **Response Sukses (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Terima kasih! Masukan dan saran Anda telah berhasil kami simpan untuk pengembangan FarmIQ.",
    "data": {
      "id": 1,
      "created_at": "2026-08-17 01:35:00"
    }
  }
  ```

### 4. Autentikasi Admin
* **Method:** `POST`
* **Path:** `/api/admin/login`
* **Content-Type:** `application/json`
* **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "farmiq2026!"
  }
  ```
* **Response Sukses (`200 OK`):**
  ```json
  {
    "success": true,
    "token": "base64-signed-hmac-token",
    "username": "admin"
  }
  ```

### 5. Mengambil Data Feedback & Statistik (Khusus Admin)
* **Method:** `GET`
* **Path:** `/api/admin/feedback`
* **Headers:** `Authorization: Bearer <token>`
* **Query Params (Opsional):** `status` (`all`|`unread`|`reviewed`|`resolved`), `category`, `search`
* **Response Sukses (`200 OK`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Pak Budi",
        "contact": "081234567890",
        "category": "Saran Fitur",
        "rating": 5,
        "message": "Aplikasi sangat membantu...",
        "status": "unread",
        "ip_address": "::1",
        "created_at": "2026-08-17 01:35:00"
      }
    ],
    "stats": {
      "total": 1,
      "unread": 1,
      "reviewed": 0,
      "resolved": 0,
      "averageRating": 5.0,
      "byCategory": { "Saran Fitur": 1 },
      "byRating": { "5": 1 }
    }
  }
  ```

### 6. Memperbarui Status Feedback (Khusus Admin)
* **Method:** `PATCH`
* **Path:** `/api/admin/feedback/:id/status`
* **Headers:** `Authorization: Bearer <token>`
* **Request Body:**
  ```json
  {
    "status": "reviewed"
  }
  ```

### 7. Menghapus Feedback (Khusus Admin)
* **Method:** `DELETE`
* **Path:** `/api/admin/feedback/:id`
* **Headers:** `Authorization: Bearer <token>`

---

## 🌐 Panduan Publikasi ke Server Gratis (*Free Hosting Deployment*)

Aplikasi FarmIQ dapat dipublikasikan ke internet secara gratis menggunakan layanan cloud modern seperti **Render.com**, **Railway**, atau **Koyeb**.

### 🌟 Opsi 1: Render.com (Sangat Direkomendasikan - Paling Mudah)

1. **Push Proyek ke GitHub:**
   - Buat repositori baru di GitHub (misalnya: `farmiq`).
   - Jalankan perintah git:
     ```bash
     git add .
     git commit -m "feat: initial production ready release"
     git branch -M main
     git remote add origin https://github.com/<username-anda>/farmiq.git
     git push -u origin main
     ```
2. **Daftar & Buat Web Service di [Render.com](https://render.com/):**
   - Login menggunakan akun GitHub.
   - Klik tombol **New +** > pilih **Web Service**.
   - Pilih repositori `farmiq` yang baru saja Anda push.
3. **Konfigurasi Build & Run Settings:**
   - **Name:** `farmiq` (atau nama pilihan Anda)
   - **Region:** `Singapore (Southeast Asia)` *(Rekomendasi untuk latency tercepat ke Indonesia)*
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Instance Type:** `Free`
4. **Atur Environment Variables (Environment Secrets):**
   - Gulir ke bagian **Environment Variables** lalu tambahkan:
     - `GEMINI_API_KEY` = `<API_KEY_GEMINI_ANDA>`
     - `GEMINI_MODEL` = `gemini-3.5-flash-lite`
     - `ADMIN_USERNAME` = `<username_admin_anda>` (contoh: `admin`)
     - `ADMIN_PASSWORD` = `<password_rahasia_anda>`
     - `ADMIN_SESSION_SECRET` = `<string_acak_panjang_untuk_keamanan_token>`
   *(Catatan: Anda tidak perlu mengatur versi Node khusus karena aplikasi kompatibel dengan semua versi Node.js LTS default seperti Node 18, 20, dan 22).*
5. **Klik "Deploy Web Service":**
   - Tunggu proses build & deploy selesai (~2 menit).
   - Render akan memberikan URL publik dengan HTTPS otomatis (misalnya: `https://farmiq.onrender.com`).

---

### 🚂 Opsi 2: Railway.app

1. Buka [railway.com](https://railway.com) dan login dengan akun GitHub.
2. Klik **New Project** > **Deploy from GitHub repo** > pilih repositori `farmiq`.
3. Tambahkan Environment Variables di tab **Variables** (`GEMINI_API_KEY`, `GEMINI_MODEL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`).
4. Buka tab **Settings** > **Networking** > Klik **Generate Domain** untuk mendapatkan URL publik.

---

### 💡 Tips & Catatan Produksi:
* **Penyimpanan Data di Free Tier:** Data masukan pengguna tersimpan lokal di dalam container (`data/feedbacks.json`). Pada paket gratis Render/Railway, data masukan (*feedback*) dapat diunduh kapan saja dalam format spreadsheet melalui tombol **Ekspor CSV** di portal admin (`https://<domain-anda>/admin`).
* **Ketersediaan Gemini API:** Dapatkan API Key gratis di [Google AI Studio](https://aistudio.google.com/).

---

## 🛡️ Peringatan Keselamatan (Safety Advisory)

FarmIQ adalah asisten kecerdasan buatan. Selalu gunakan Alat Pelindung Diri (APD) lengkap saat mengaplikasikan pestisida/bahan kimia, patuhi batas aman waktu tunggu panen (*Pre-Harvest Interval*), dan konsultasikan kondisi kritis hewan ternak dengan dokter hewan setempat.

---

## 📄 Lisensi
Hak Cipta © 2026 **FarmIQ Team** • Hacktiv8 Final Project.
