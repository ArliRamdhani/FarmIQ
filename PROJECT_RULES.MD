# FarmIQ - Project Rules & Guidelines

## Tech Stack
- **Language:** TypeScript (`strict: true`, ES Modules)
- **Backend:** Node.js, Express.js 5
- **Database / Data Store:** Atomic Persistent File Storage (`data/feedbacks.json`) with in-memory caching and instant zero-dependency cloud compatibility
- **Authentication:** HMAC SHA-256 Signed Session Tokens for Owner/Admin access
- **File Handling:** Multer (In-Memory Buffer Storage for Images & Live Mic Voice Notes)
- **AI Integration:** Google Gemini REST API (`generativelanguage.googleapis.com`)
- **Frontend:** Single-page HTML5, Tailwind CSS, Vanilla JavaScript, Marked.js, Highlight.js, Font Awesome

## Coding & TypeScript Standards
- Gunakan **TypeScript** dengan konfigurasi `strict: true`.
- Seluruh kode sumber backend ditempatkan di dalam direktori `src/` (`src/server.ts`, `src/db.ts`).
- Definisikan `interface` atau `type` eksplisit untuk Request Body, File Upload (Multer), Feedback Record, dan Struktur Payload/Response Gemini API.
- Jangan simpan file gambar atau rekaman suara ke disk lokal; olah `file.buffer` langsung menjadi string Base64 (`inlineData`) untuk dikirim ke Gemini.
- Selalu sertakan `systemInstruction` pada payload Gemini dengan persona "FarmIQ Specialist".
- Data persistensi masukan pengguna (feedback) disimpan secara aman di `data/feedbacks.json`.
- Gunakan `tsx` untuk eksekusi file `.ts` saat pengembangan (*hot-reloading*).

## Project Directory Blueprint
```text
FarmIQ/
├── .env                  # Konfigurasi environment (diabaikan git)
├── .env.example          # Template konfigurasi environment
├── .gitignore            # Pengaturan file git ignore
├── tsconfig.json         # Konfigurasi TypeScript
├── PROJECT_RULES.md      # Standar dan aturan pengembangan proyek
├── README.md             # Dokumentasi lengkap proyek
├── package.json          # Dependensi & build scripts
├── data/                 # Penyimpanan Data Feedback (diabaikan git)
│   └── feedbacks.json
├── src/
│   ├── server.ts         # Server Express, routing, keamanan & integrasi Gemini API
│   └── db.ts             # Data store layer atomic persistent & in-memory cache
└── public/
    ├── index.html        # Frontend dashboard antarmuka pengguna FarmIQ
    ├── admin.html        # Portal admin pengelola feedback pengguna
    ├── favicon.ico       # Favicon browser multi-resolusi
    └── assets/
        └── images/       # Folder aset visual & logo
            ├── logo-full.png # Logo horizontal lengkap (Emblem, Nama, Slogan)
            ├── logo.png      # Logo emblem persegi
            ├── app-name.png  # Tipografi nama & slogan FarmIQ
            ├── favicon.png   # Favicon PNG
            └── favicon.ico   # Favicon ICO
```

## API Endpoint Blueprint
- `GET /api/health` — Status kesehatan server dan model AI aktif.
- `POST /api/chat` — Konsultasi & diagnosa AI multimodal (prompt teks, gambar daun/hama, rekaman suara).
- `POST /api/feedback` — Pengiriman formulir masukan & rating dari pengguna.
- `POST /api/admin/login` — Autentikasi admin pengelola dengan username & password.
- `GET /api/admin/verify` — Verifikasi validitas token sesi admin.
- `GET /api/admin/feedback` — Mengambil daftar masukan pengguna dan agregasi statistik rating.
- `GET /api/admin/feedback/export` — Mengunduh backup data feedback dalam format JSON atau CSV.
- `POST /api/admin/feedback/import` — Memulihkan atau menggabungkan data feedback dari berkas JSON / CSV.
- `PATCH /api/admin/feedback/:id/status` — Memperbarui status masukan (`unread`, `reviewed`, `resolved`).
- `DELETE /api/admin/feedback/:id` — Menghapus data masukan pengguna.
- `GET /admin` — Menyajikan halaman web portal pengelola (`public/admin.html`).