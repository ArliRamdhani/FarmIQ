# Changelog (Catatan Perubahan Versi) FarmIQ 🌾

Semua perubahan penting pada proyek **FarmIQ** akan didokumentasikan dalam berkas ini.

Format berkas ini mengacu pada [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan mematuhi standar [Semantic Versioning (SemVer)](https://semver.org/lang/id/).

---

## 📋 Panduan Format Pencatatan Versi Baru

Ketika merilis versi baru, tambahkan bagian baru di bawah judul berkas dengan format:
```markdown
## [X.Y.Z] - YYYY-MM-DD
### Added (Ditambahkan)
- Fitur baru yang ditambahkan ke aplikasi.

### Changed (Diubah)
- Perubahan pada fungsionalitas yang sudah ada sebelumnya.

### Fixed (Diperbaiki)
- Perbaikan bug atau galat pada sistem.

### Security (Keamanan)
- Peningkatan keamanan atau penambalan celah.
```

---

## [1.1.0] - 2026-08-18

### 🌟 Added (Ditambahkan)
* **Memori Percakapan Multi-Turn (*Chat Conversation Memory*):**
  - Penyimpanan riwayat obrolan independen untuk masing-masing tab mode layanan (`consultation`, `diagnosis`, `market`).
  - Pengiriman riwayat obrolan secara otomatis ke Gemini API dengan pembatasan jendela geser (*sliding window*) 10 pertukaran terakhir untuk efisiensi token.
  - Aturan *Greeting Suppression*: Salam pembuka hanya muncul pada pesan pertama; pesan lanjutan langsung dijawab secara to-the-point tanpa perkenalan berulang.
* **Portabilitas Data Feedback (Ekspor & Impor JSON & CSV):**
  - Tombol **Ekspor JSON** dan **Ekspor CSV** di Portal Admin `/admin` untuk mencadangkan data masukan pengguna.
  - Fitur **Impor Data Feedback** (JSON & CSV) dengan opsi penggabungan (*Merge*) atau penimpaan (*Replace*) serta validasi baris real-time.
* **Sistem Pembatasan Kuota Gratis Harian (*Daily Free Quota Limit*):**
  - Pembatasan 15 chat/hari per perangkat secara lokal melalui `localStorage`.
  - Indikator status kuota interaktif (*pill badge*) pada bilah input dengan transisi warna cerdas (Emerald $\to$ Amber $\to$ Rose).
  - Modal notifikasi kuota habis (`#quotaExceededModal`) yang terhubung langsung ke formulir masukan (*feedback loop*) untuk permohonan kuota tambahan.
* **Bilah Status Mode Aktif Khusus Mobile:**
  - Bilah status *sticky* di bawah header pada layar mobile/tablet (`md:hidden`) dengan badge dinamis dan tombol cepat "Ganti".
* **Panduan Pengelolaan Biaya & Anggaran Internal:**
  - Berkas `PANDUAN_BIAYA_DAN_KUOTA.md` untuk panduan non-teknis kalkulasi token, estimasi biaya, dan konfigurasi Google Cloud Budget Alerts.

### 🔄 Changed (Diubah)
* **Mode-Specific System Instructions & Contextual Pivot (Opsi 2):**
  - Memisahkan instruksi sistem global menjadi 3 instruksi spesifik untuk mode *Konsultasi*, *Check Kesehatan*, dan *Update Pasar*.
  - Menerapkan aturan *Contextual Pivot*: Menjawab pertanyaan di luar domain dari sudut pandang ekonomi/biaya pasar terlebih dahulu, lalu menyertakan rekomendasi ramah untuk beralih mode.
* **Pembersihan Antarmuka (UI Cleanup):**
  - Menghapus badge statis yang tidak diperlukan pada kartu informasi utama (*Hero Cards*).
  - Menghapus teks petunjuk navigasi panah keyboard pada modal *Onboarding*.
* **Pembaruan Dokumentasi:**
  - Menambahkan tautan URL deployment aktif di Render (`https://farmiq-2he9.onrender.com/`) ke `README.md` dan `PROJECT_RULES.MD`.

### 🐛 Fixed (Diperbaiki)
* Memperbaiki tombol "Buka" pada slide onboarding 2, 3, dan 4 agar beralih ke mode layanan yang sesuai menggunakan `switchServiceMode`.
* Memulihkan kontainer daftar feedback `#feedbackList` dan status kosong `#emptyState` di halaman `/admin`.
* Memperbaiki penanganan elemen form feedback dan status tombol disabled untuk mencegah galat JavaScript.

---

## [1.0.0] - 2026-08-16

### 🚀 Added (Rilis Awal)
* **Integrasi AI Google Gemini REST API:**
  - Model `gemini-3.5-flash-lite` dengan arsitektur multi-fallback otomatis (`gemini-2.5-flash`, `gemini-1.5-flash`).
* **Dukungan Input Multimodal Lengkap:**
  - Input teks interaktif, unggahan foto/kamera (JPG, PNG, WEBP), dan perekaman suara mikrofon langsung (*live voice notes*).
* **3 Mode Layanan Spesialis Pertanian & Peternakan:**
  - Konsultasi Umum Agronomi & Peternakan.
  - Check Kesehatan & Diagnosa AI.
  - Update Informasi & Pasar Komoditas.
* **Portal Admin Manajemen Feedback Pengguna (`/admin`):**
  - Otentikasi token bertanda tangan **HMAC SHA-256** (masa berlaku 7 hari).
  - Statistik real-time, filter status, pencarian, dan tautan langsung WhatsApp.
* **Atomic Persistent JSON Storage:**
  - Penyimpanan berkas aman `data/feedbacks.json` dengan caching in-memory.
* **Pengerasan Keamanan Produksi (*Security Hardening*):**
  - In-memory rate limiting (30 req/menit per IP), security headers, sanitasi log API key, dan penanganan graceful shutdown.
