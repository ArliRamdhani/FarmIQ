import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dbService } from './db.js';

// Load environment variables
dotenv.config();

// Determine directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// TypeScript Interfaces & Types
// ==========================================

// Gemini REST API Types
export interface GeminiTextPart {
  text: string;
}

export interface GeminiInlineDataPart {
  inlineData: {
    mimeType: string;
    data: string; // Base64 encoded string
  };
}

export type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

export interface GeminiContent {
  role?: 'user' | 'model' | 'system';
  parts: GeminiPart[];
}

export interface GeminiSystemInstruction {
  parts: GeminiTextPart[];
}

export interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
}

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

export interface GeminiRequestPayload {
  contents: GeminiContent[];
  systemInstruction?: GeminiSystemInstruction;
  generationConfig?: GeminiGenerationConfig;
  safetySettings?: GeminiSafetySetting[];
}

export interface GeminiCandidatePart {
  text?: string;
}

export interface GeminiCandidateContent {
  parts?: GeminiCandidatePart[];
  role?: string;
}

export interface GeminiCandidate {
  content?: GeminiCandidateContent;
  finishReason?: string;
  index?: number;
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
}

export interface GeminiPromptFeedback {
  blockReason?: string;
  safetyRatings?: Array<{
    category: string;
    probability: string;
  }>;
}

export interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

// Application Request/Response Types
export interface ChatRequestBody {
  prompt?: string;
  mode?: 'consultation' | 'diagnosis' | 'market';
  history?: string; // JSON array string of past exchanges: Array<{ role: 'user' | 'model', text: string }>
}

export interface MulterChatRequest extends Request {
  body: ChatRequestBody;
  files?: {
    [fieldname: string]: Express.Multer.File[];
  } | Express.Multer.File[];
  file?: Express.Multer.File;
}

export interface ChatApiResponseSuccess {
  success: true;
  reply: string;
  model: string;
  hasImage: boolean;
  hasAudio: boolean;
  timestamp: string;
}

export interface ChatApiResponseError {
  success: false;
  error: string;
  details?: unknown;
}

export type ChatApiResponse = ChatApiResponseSuccess | ChatApiResponseError;

// ==========================================
// Mode-Specific System Instructions: Option 2 (Contextual Pivot & Multi-turn Aware)
// ==========================================
const MODE_SYSTEM_INSTRUCTIONS: Record<string, GeminiSystemInstruction> = {
  // 1. KONSULTASI UMUM AGRONOMI & PETERNAKAN
  consultation: {
    parts: [
      {
        text: `Anda adalah "FarmIQ Specialist" dalam mode "Konsultasi Umum Agronomi & Peternakan Terpadu".
Fokus Utama Layanan:
- Panduan teknis budidaya tanaman pangan, hortikultura, perkebunan, dan budidaya pekarangan pemula (polybag, pot, jamur, hidroponik).
- Perhitungan formula dan dosis pemupukan berimbang (NPK, Urea, ZA, SP-36, pupuk organik/kompos).
- Manajemen jadwal tanam, persiapan lahan, pengolahan tanah, dan sistem irigasi.
- Manajemen peternakan skala kecil hingga komersial: nutrisi formulasi pakan ternak (ayam, bebek, sapi, kambing, kelinci, ikan/lele), pemeliharaan kandang, dan biosekuriti.

Aturan Komunikasi & Riwayat Obrolan (Multi-Turn Chat Guidelines):
1. Salam pembuka (seperti "Halo!", "Selamat datang di FarmIQ...") dan perkenalan diri HANYA diucapkan SATU KALI pada awal percakapan (jika belum ada riwayat obrolan).
2. Pada balasan pesan lanjutan (jika sudah ada riwayat percakapan sebelumnya), LANGSUNG jawab inti pertanyaan secara to-the-point tanpa mengulang salam pembuka, sapaan formal, atau perkenalan diri lagi.
3. Gunakan seluruh informasi dari percakapan sebelumnya untuk menjawab pertanyaan lanjutan secara konsisten, relevan, dan terhubung.
4. Gunakan format Markdown rapi (Heading, Bold, Bullet points) dengan takaran praktis yang presisi.

Aturan Guardrail Konteks (Contextual Pivot):
- Jika pengguna menanyakan analisis tren harga komoditas pasar harian secara spesifik atau mekanisme kuota subsidi pupuk e-RDKK: Berikan perkiraan gambaran teknis/biaya input secara umum, lalu tambahkan rekomendasi di akhir:
  "💡 *Catatan:* Untuk pantauan harga acuan pasar komoditas pangan harian dan info kebijakan subsidi e-RDKK, Anda dapat membuka tab **Mode Update Info & Pasar**."
- Jika pengguna mengunggah foto gejala penyakit parah atau hama tanaman/ternak yang butuh diagnosa klinis: Berikan pertolongan pertama umum, lalu tambahkan rekomendasi:
  "💡 *Catatan:* Untuk diagnosa visual detail berbasis foto dan tingkat keparahan patogen, silakan gunakan tab **Mode Check Kesehatan**."`
      }
    ]
  },

  // 2. CHECK KESEHATAN & DIAGNOSA AI
  diagnosis: {
    parts: [
      {
        text: `Anda adalah "FarmIQ Specialist" dalam mode "Check Kesehatan & Diagnosa AI" (Spesialis Patologi Tanaman & Kesehatan Ternak).
Fokus Utama Layanan:
- Mendiagnosa penyakit tanaman (jamur, bakteri, virus, defisiensi hara) dan serangan hama (wereng, ulat, kutu kebul, penggerek) dari foto gejala daun/batang/buah atau deskripsi suara.
- Mendiagnosa kondisi klinis dan patologi fisik hewan ternak yang sakit (unggas, ruminansia, kelinci, ikan).
- Memberikan struktur analisa diagnosa wajib:
  * **🔬 Diagnosa & Identifikasi Patogen/Hama:** Nama patogen/hama, gejala klinis yang teridentifikasi.
  * **⚠️ Tingkat Urgensi / Keparahan:** Ringan, Sedang, atau Kritis.
  * **💊 Tindakan Cepat (Penanganan Langsung):** Solusi mekanis/organik serta obat/pestisida kimia jika darurat (sebutkan bahan aktif dan dosis aman).
  * **🛡️ Pencegahan Jangka Panjang:** Praktik agronomis (rotasi tanaman, sanitasi, biosekuriti).
  * **⚠️ Peringatan Keselamatan:** Gunakan APD saat aplikasi bahan kimia.

Aturan Komunikasi & Riwayat Obrolan (Multi-Turn Chat Guidelines):
1. Salam pembuka dan perkenalan diri HANYA diucapkan SATU KALI pada awal percakapan (jika belum ada riwayat obrolan).
2. Pada balasan pesan lanjutan, LANGSUNG jawab inti diagnosa atau langkah penanganan secara to-the-point tanpa mengulang salam pembuka atau perkenalan diri lagi.
3. Pertahankan konsistensi analisa berdasarkan gejala atau foto yang telah dikirimkan pada pesan-pesan sebelumnya.

Aturan Guardrail Konteks (Contextual Pivot):
- Selalu utamakan penyelamatan tanaman/hewan yang bergejala sakit.
- Jika pengguna menanyakan hal non-kesehatan (misal: harga pasar komoditas atau teknik budidaya umum di luar konteks penyakit): Tanggapi secara singkat relevansinya terhadap kesehatan tanaman/hewan, lalu tambahkan rekomendasi di akhir:
  "💡 *Catatan:* Mode ini difokuskan untuk diagnosa penyakit & hama. Untuk panduan lengkap budidaya atau tren harga pasar, silakan gunakan tab **Mode Konsultasi Umum** atau **Mode Update Info & Pasar**."`
      }
    ]
  },

  // 3. UPDATE INFORMASI & PASAR KOMODITAS
  market: {
    parts: [
      {
        text: `Anda adalah "FarmIQ Specialist" dalam mode "Update Informasi & Pasar Komoditas" (Spesialis Agribisnis, Analisis Pasar Pangan & Kebijakan Pertanian).
Fokus Utama Layanan:
- Pantauan harga acuan komoditas pangan nasional (Beras, Cabai, Bawang, Jagung, Daging Sapi/Ayam, Telur, Kedelai, Pupuk).
- Analisis tren pasar agribisnis: proyeksi musim panen, faktor fluktuasi permintaan/pasokan, momentum hari besar.
- Analisis kelayakan ekonomi, estimasi modal awal, efisiensi biaya input pakan/pupuk, dan perhitungan marjin keuntungan usaha agrikultur.
- Informasi cuaca agroklimatologi dan regulasi pemerintah (misalnya kuota subsidi pupuk e-RDKK, syarat penerima, dan mekanisme penebusan).

Aturan Komunikasi & Riwayat Obrolan (Multi-Turn Chat Guidelines):
1. Salam pembuka (seperti "Halo!", "Selamat datang di FarmIQ...") dan perkenalan diri HANYA diucapkan SATU KALI pada awal percakapan (jika belum ada riwayat obrolan).
2. Pada balasan pesan lanjutan (jika sudah ada riwayat obrolan sebelumnya), LANGSUNG berikan analisis data atau harga secara to-the-point tanpa mengulang salam pembuka, sapaan formal, atau perkenalan diri lagi.
3. Gunakan angka, estimasi biaya, dan konteks dari percakapan sebelumnya untuk menjawab pertanyaan lanjutan secara konsisten.

Aturan Guardrail Konteks (Contextual Pivot Opsi 2 - WAJIB DITERAPKAN):
- Jika pengguna mengajukan pertanyaan teknis budidaya, peternakan, atau perawatan tanaman di mode ini (misalnya: "tips memulai ternak ayam 10 ekor dirumah untuk kebutuhan telur", "cara menyemai benih cabai", "dosis pupuk npk", dll):
  1. **Jawab pertanyaan DARI SUDUT PANDANG EKONOMI PASAR, ESTIMASI BIAYA & ANALISIS BISNIS TERLEBIH DAHULU.** (Contoh untuk ternak ayam 10 ekor: jelaskan estimasi biaya pakan harian komersial vs pakan alternatif, perbandingan harga beli telur di pasar vs biaya produksi mandiri 10 ekor layer, dan efisiensi ekonominya).
  2. **Di akhir jawaban, SELALU tambahkan rekomendasi pengalihan mode yang jelas dan ramah:**
     "💡 **Rekomendasi Mode:** Untuk panduan teknis mendalam mengenai tata cara pembuatan kandang ramah lingkungan, manajemen ventilasi, pemilihan bibit (pullet), dan jadwal vaksinasi, silakan beralih ke **Mode Konsultasi Umum** di panel navigasi."
- Jika pengguna menanyakan penyakit tanaman/hewan di mode ini: Berikan gambaran potensi kerugian ekonomi/pasar dari serangan wabah tersebut, lalu sarankan beralih ke **Mode Check Kesehatan** untuk diagnosa visual foto dan resep obat.`
      }
    ]
  }
};

// ==========================================
// Express Application Setup
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'farmiq2026!';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'farmiq_super_secret_session_token_key_2026';

// Fallback candidate models if requested model is deprecated/unavailable
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3-flash-preview'];

// Disable fingerprinting header for production security
app.disable('x-powered-by');

// Security Headers Middleware
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Middleware standard configuration
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static assets from public/ folder
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// In-Memory Rate Limiter (Production Abuse Prevention: 30 requests/minute per IP)
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const now = Date.now();

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    res.status(429).json({
      success: false,
      error: `Terlalu banyak permintaan. Silakan tunggu ${retryAfterSec} detik sebelum mencoba kembali.`
    });
    return;
  }

  record.count++;
  next();
}

// Clean up stale rate limit records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Allowed Image & Audio MIME types
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  // Audio / Voice
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/x-m4a',
  'audio/m4a',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
  'audio/x-flac'
];

// Multer memory storage configuration (Never save files to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for audio & photos
    files: 3
  },
  fileFilter: (_req, file, cb) => {
    const mimeBase = file.mimetype.split(';')[0].toLowerCase();
    if (ALLOWED_MIME_TYPES.includes(mimeBase) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Tipe file ${file.mimetype} tidak didukung. Harap unggah file foto (JPEG, PNG, WEBP) atau audio (MP3, WAV, M4A, OGG, WEBM).`));
    }
  }
});

// Helper function to sanitize logs by stripping sensitive API keys
function sanitizeLogMessage(msg: string): string {
  return msg.replace(/key=[a-zA-Z0-9_-]+/g, 'key=REDACTED');
}

// ==========================================
// Admin Authentication Helpers (HMAC Tokens)
// ==========================================
function generateAdminToken(username: string): string {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = `${username}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

function verifyAdminToken(token: string): { valid: boolean; username?: string } {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, expiresAtStr, signature] = decoded.split(':');
    if (!username || !expiresAtStr || !signature) return { valid: false };

    const expiresAt = Number(expiresAtStr);
    if (Date.now() > expiresAt) return { valid: false };

    const expectedSignature = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(`${username}:${expiresAtStr}`).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return { valid: true, username };
    }
  } catch {
    return { valid: false };
  }
  return { valid: false };
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || req.headers['x-admin-token'];
  let token = '';

  if (typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (!token) {
    res.status(401).json({ success: false, error: 'Akses ditolak. Token otentikasi admin diperlukan.' });
    return;
  }

  const check = verifyAdminToken(token);
  if (!check.valid || check.username !== ADMIN_USERNAME) {
    res.status(401).json({ success: false, error: 'Sesi admin tidak valid atau telah kedaluwarsa. Silakan login kembali.' });
    return;
  }

  next();
}

// ==========================================
// API Routes
// ==========================================

// Health Check Endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'FarmIQ Backend API',
    model: GEMINI_MODEL,
    multimodal: ['text', 'image', 'audio'],
    timestamp: new Date().toISOString()
  });
});

// User Feedback Submission Endpoint (Public for Beta Users)
app.post('/api/feedback', (req: Request, res: Response) => {
  try {
    const { name, contact, category, rating, message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({
        success: false,
        error: 'Pesan masukan tidak boleh kosong.'
      });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const newRecord = dbService.insertFeedback({
      name,
      contact,
      category,
      rating: Number(rating) || 5,
      message,
      ip_address: String(ip),
      user_agent: String(userAgent)
    });

    res.status(201).json({
      success: true,
      message: 'Terima kasih! Masukan dan saran Anda telah berhasil kami simpan untuk pengembangan FarmIQ.',
      data: {
        id: newRecord.id,
        created_at: newRecord.created_at
      }
    });
  } catch (err) {
    console.error('Error inserting feedback:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Gagal menyimpan masukan ke database.'
    });
  }
});

// Admin Login Endpoint
app.post('/api/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = generateAdminToken(username);
    res.status(200).json({
      success: true,
      token,
      username
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Username atau password admin salah!'
    });
  }
});

// Admin Verify Token Endpoint
app.get('/api/admin/verify', requireAdminAuth, (_req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Authenticated' });
});

// Admin Get Feedback List Endpoint
app.get('/api/admin/feedback', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const feedbacks = dbService.getAllFeedbacks({ status, category, search });
    const stats = dbService.getStats();

    res.status(200).json({
      success: true,
      data: feedbacks,
      stats
    });
  } catch (err) {
    console.error('Error fetching feedbacks:', err);
    res.status(500).json({
      success: false,
      error: 'Gagal mengambil data masukan dari database.'
    });
  }
});

// Admin Update Feedback Status Endpoint
app.patch('/api/admin/feedback/:id/status', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!['unread', 'reviewed', 'resolved'].includes(status)) {
      res.status(400).json({ success: false, error: 'Status tidak valid.' });
      return;
    }

    const updated = dbService.updateStatus(id, status);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Data masukan tidak ditemukan.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Status berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal memperbarui status.' });
  }
});

// Admin Delete Feedback Endpoint
app.delete('/api/admin/feedback/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const deleted = dbService.deleteFeedback(id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Data masukan tidak ditemukan.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Masukan berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal menghapus masukan.' });
  }
});

// Admin Export Feedback Endpoint (JSON / CSV)
app.get('/api/admin/feedback/export', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string)?.toLowerCase() === 'csv' ? 'csv' : 'json';
    const exported = dbService.exportFeedbacks(format);

    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.status(200).send(exported.content);
  } catch (err) {
    console.error('Error exporting feedbacks:', err);
    res.status(500).json({
      success: false,
      error: 'Gagal mengekspor data masukan.'
    });
  }
});

// Admin Import Feedback Endpoint (JSON / CSV with merge or replace)
app.post('/api/admin/feedback/import', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const { mode = 'merge', data, raw, format } = req.body;

    if (mode !== 'merge' && mode !== 'replace') {
      res.status(400).json({
        success: false,
        error: 'Mode impor tidak valid. Pilih "merge" (gabungkan) atau "replace" (timpa semua).'
      });
      return;
    }

    let recordsToImport: Array<Record<string, unknown>> = [];

    if (Array.isArray(data)) {
      recordsToImport = data;
    } else if (typeof raw === 'string' && raw.trim().length > 0) {
      const trimmed = raw.trim();
      if (format === 'csv' || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) {
        recordsToImport = dbService.parseCSV(trimmed);
      } else {
        const parsed = JSON.parse(trimmed);
        recordsToImport = Array.isArray(parsed) ? parsed : [parsed];
      }
    } else {
      res.status(400).json({
        success: false,
        error: 'Payload data impor tidak ditemukan. Harap unggah file JSON atau CSV yang valid.'
      });
      return;
    }

    const result = dbService.importFeedbacks(recordsToImport, mode);
    const stats = dbService.getStats();

    res.status(200).json({
      success: true,
      message: `Berhasil mengimpor ${result.importedCount} data masukan (${mode === 'replace' ? 'Semua data lama digantikan' : 'Data digabungkan'}).`,
      data: result,
      stats
    });
  } catch (err) {
    console.error('Error importing feedbacks:', err);
    res.status(400).json({
      success: false,
      error: err instanceof Error ? err.message : 'Gagal memproses berkas impor.'
    });
  }
});

// Chat & Multimodal Analysis Endpoint (Text, Images, Audio Voice Notes)
app.post(
  '/api/chat',
  rateLimitMiddleware,
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'file', maxCount: 1 }
  ]),
  async (req: MulterChatRequest, res: Response<ChatApiResponse>): Promise<void> => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          success: false,
          error: 'GEMINI_API_KEY belum dikonfigurasi pada server (.env).'
        });
        return;
      }

      const rawPrompt = req.body.prompt;
      const prompt = rawPrompt ? String(rawPrompt).trim() : '';

      // Validate prompt length to prevent memory abuse
      if (prompt.length > 6000) {
        res.status(400).json({
          success: false,
          error: 'Teks pertanyaan terlalu panjang! Batas maksimal adalah 6.000 karakter.'
        });
        return;
      }

      // Extract uploaded files from Multer
      let imageFile: Express.Multer.File | undefined;
      let audioFile: Express.Multer.File | undefined;

      if (req.files && typeof req.files === 'object') {
        if (!Array.isArray(req.files)) {
          if (req.files['image'] && req.files['image'].length > 0) {
            imageFile = req.files['image'][0];
          }
          if (req.files['audio'] && req.files['audio'].length > 0) {
            audioFile = req.files['audio'][0];
          }
          if (req.files['file'] && req.files['file'].length > 0) {
            const genericFile = req.files['file'][0];
            if (genericFile.mimetype.startsWith('audio/')) {
              audioFile = genericFile;
            } else if (genericFile.mimetype.startsWith('image/')) {
              imageFile = genericFile;
            }
          }
        } else {
          for (const f of req.files) {
            if (f.mimetype.startsWith('audio/')) audioFile = f;
            if (f.mimetype.startsWith('image/')) imageFile = f;
          }
        }
      } else if (req.file) {
        if (req.file.mimetype.startsWith('audio/')) {
          audioFile = req.file;
        } else {
          imageFile = req.file;
        }
      }

      if (!prompt && !imageFile && !audioFile) {
        res.status(400).json({
          success: false,
          error: 'Harap masukkan pertanyaan (prompt), unggah gambar, atau lampirkan rekaman suara/audio.'
        });
        return;
      }

      // Build Gemini parts payload
      const parts: GeminiPart[] = [];

      // If an image is provided, encode buffer directly to Base64 (in-memory)
      if (imageFile) {
        const imageBase64 = imageFile.buffer.toString('base64');
        const mime = imageFile.mimetype.split(';')[0];
        parts.push({
          inlineData: {
            mimeType: mime,
            data: imageBase64
          }
        });
      }

      // If an audio file/voice note is provided, encode buffer directly to Base64 (in-memory)
      if (audioFile) {
        const audioBase64 = audioFile.buffer.toString('base64');
        const mime = audioFile.mimetype.split(';')[0];
        parts.push({
          inlineData: {
            mimeType: mime,
            data: audioBase64
          }
        });
      }

      // Append text prompt
      let defaultFallback = 'Tolong analisa kondisi tanaman atau hewan pada gambar ini dan berikan diagnosa lengkap serta langkah penanganan terbaik.';
      if (audioFile && !imageFile) {
        defaultFallback = 'Tolong dengarkan dan jawab pertanyaan atau instruksi dari rekaman suara/audio ini secara lengkap, praktis, dan solutif.';
      } else if (audioFile && imageFile) {
        defaultFallback = 'Tolong dengarkan rekaman suara serta analisa gambar yang saya lampirkan, lalu berikan solusi agronomi/veteriner terbaik.';
      }

      const finalPrompt = prompt || defaultFallback;
      parts.push({
        text: finalPrompt
      });

      // Select mode-specific system instruction
      const requestedMode = (req.body.mode as string) || 'consultation';
      const selectedSystemInstruction = MODE_SYSTEM_INSTRUCTIONS[requestedMode] || MODE_SYSTEM_INSTRUCTIONS.consultation;

      // Parse multi-turn chat history if provided
      let historyTurns: Array<{ role: 'user' | 'model'; parts: GeminiPart[] }> = [];
      if (req.body.history) {
        try {
          const rawHistory = typeof req.body.history === 'string' ? JSON.parse(req.body.history) : req.body.history;
          if (Array.isArray(rawHistory)) {
            historyTurns = rawHistory
              .filter(item => item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string' && item.text.trim().length > 0)
              .slice(-10) // Keep the last 10 exchanges (20 items max) to optimize token usage and context
              .map(item => ({
                role: item.role === 'user' ? 'user' : 'model',
                parts: [{ text: item.text.trim() }]
              }));
          }
        } catch (err) {
          console.warn('Failed to parse chat history:', err);
        }
      }

      // Construct Gemini request payload with Multi-Turn history
      const geminiPayload: GeminiRequestPayload = {
        systemInstruction: selectedSystemInstruction,
        contents: [
          ...historyTurns,
          {
            role: 'user',
            parts: parts
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048
        }
      };

      // Model resolution with fallback
      const modelsToTry = [GEMINI_MODEL, ...FALLBACK_MODELS.filter(m => m !== GEMINI_MODEL)];
      let lastErrorMessage = '';
      let successfulResponseData: GeminiResponse | null = null;
      let usedModel = GEMINI_MODEL;

      for (const modelCandidate of modelsToTry) {
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${apiKey}`;

        try {
          const geminiResponse = await fetch(geminiApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(geminiPayload)
          });

          if (geminiResponse.ok) {
            successfulResponseData = (await geminiResponse.json()) as GeminiResponse;
            usedModel = modelCandidate;
            break;
          }

          const errorText = await geminiResponse.text();
          let errorJson: GeminiResponse | null = null;
          try {
            errorJson = JSON.parse(errorText) as GeminiResponse;
          } catch {
            // ignore parsing error
          }

          lastErrorMessage = errorJson?.error?.message || `Gemini API error (Status ${geminiResponse.status}): ${errorText}`;
          console.warn(`Model ${modelCandidate} failed (${geminiResponse.status}): ${sanitizeLogMessage(lastErrorMessage)}. Trying next candidate...`);
        } catch (fetchErr) {
          lastErrorMessage = fetchErr instanceof Error ? fetchErr.message : 'Network error';
          console.warn(`Model ${modelCandidate} fetch failed: ${sanitizeLogMessage(lastErrorMessage)}. Trying next candidate...`);
        }
      }

      if (!successfulResponseData) {
        res.status(500).json({
          success: false,
          error: `Gagal berkomunikasi dengan layanan AI: ${sanitizeLogMessage(lastErrorMessage)}`
        });
        return;
      }

      const responseData = successfulResponseData;

      // Extract generated text from candidates
      const candidate = responseData.candidates?.[0];
      const replyText = candidate?.content?.parts?.map(p => p.text || '').join('\n') || '';

      if (!replyText) {
        const blockReason = responseData.promptFeedback?.blockReason;
        const msg = blockReason
          ? `Respons diblokir oleh filter keamanan AI (${blockReason}). Silakan coba pertanyaan lain.`
          : 'AI tidak menghasilkan respons. Silakan coba kembali.';

        res.status(500).json({
          success: false,
          error: msg
        });
        return;
      }

      res.status(200).json({
        success: true,
        reply: replyText,
        model: usedModel,
        hasImage: Boolean(imageFile),
        hasAudio: Boolean(audioFile),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Unhandled Server Error in /api/chat:', error);
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan internal pada server.';
      res.status(500).json({
        success: false,
        error: message
      });
    }
  }
);

// Admin Portal Static Route
app.get('/admin', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// Multer and general API error handling middleware (Registered before wildcard SPA fallback)
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'Ukuran file terlalu besar! Batas maksimal unggahan adalah 25MB.'
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: `Kesalahan upload: ${err.message}`
    });
    return;
  }
  if (err instanceof Error) {
    res.status(400).json({
      success: false,
      error: err.message
    });
    return;
  }
  next(err);
});

// Fallback Route for Single Page Application (Express 5 compatible)
app.use((_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`🌾 FarmIQ Server is running on http://localhost:${PORT}`);
  console.log(`🤖 AI Engine: Gemini REST API (${GEMINI_MODEL})`);
  console.log(`📁 Static files served from: ${publicPath}`);
  console.log(`🔒 Production security hardening enabled (Rate-limiting, Security headers, Sanitized logs)`);
  console.log(`💼 Admin Feedback Portal available at http://localhost:${PORT}/admin`);
});

// Graceful Shutdown for Cloud/Container Production Environments
if (process.env.NODE_ENV === 'production') {
  function handleGracefulShutdown(signal: string): void {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(() => {
      console.log('✅ FarmIQ HTTP server closed cleanly.');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('⚠️ Could not close connections in time, forcefully shutting down.');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
}
