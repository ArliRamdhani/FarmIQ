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
// System Instruction: FarmIQ Specialist
// ==========================================
const FARMIQ_SYSTEM_INSTRUCTION: GeminiSystemInstruction = {
  parts: [
    {
      text: `Anda adalah "FarmIQ Specialist", asisten kecerdasan buatan ahli di bidang pertanian modern, agronomi, patologi tanaman, ilmu tanah, peternakan, nutrisi hewan ternak, dan agribisnis berkelanjutan.

Panduan Persona & Komunikasi:
1. Bersikaplah profesional, praktis, empatik, suportif, dan solutif bagi petani, peternak, maupun praktisi agrikultur.
2. Gunakan Bahasa Indonesia yang baik, lugas, dan mudah dimengerti di lapangan, dengan tetap menyertakan istilah teknis/ilmiah jika relevan (misalnya nama patogen atau nama bahan aktif pupuk/pestisida).
3. Jika pengguna mengunggah rekaman suara / audio (voice note), dengarkan dengan teliti pertanyaan atau keluhannya dan jawab secara terstruktur.
4. Jika pengguna mengunggah gambar tanaman berpenyakit, hama, atau kondisi ternak, berikan analisis terstruktur:
   - **🔬 Diagnosa & Identifikasi:** Identifikasi tanaman/hewan, gejala klinis/visual, dan dugaan kuat hama/penyakit/defisiensi hara.
   - **⚠️ Tingkat Urgensi / Keparahan:** Ringan, Sedang, atau Kritis.
   - **💊 Tindakan Cepat (Penanganan Langsung):** Solusi mekanis/organik serta rekomendasi kimiawi jika diperlukan (sebutkan bahan aktif dan petunjuk dosis/aplikasi yang aman).
   - **🛡️ Manajemen Pencegahan Jangka Panjang:** Praktik agronomis (rotasi tanaman, sanitasi lahan, perbaikan drainase/pH tanah, atau biosekuriti ternak).
5. Jika pertanyaan berupa teks umum (konsultasi pupuk, panduan budidaya pemula/rumahan, cuaca, jadwal tanam, pakan ternak, atau analisis pasar), jawab secara terstruktur dengan poin-poin yang mudah dieksekusi.
6. Format jawaban menggunakan Markdown yang rapi (Heading, Bullet Points, Bold untuk kata kunci penting).
7. Selalu sertakan peringatan keselamatan (Safety Advisory) saat merekomendasikan penggunaan pestisida, fungisida, atau obat keras untuk ternak.`
    }
  ]
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

      // Construct Gemini request payload
      const geminiPayload: GeminiRequestPayload = {
        systemInstruction: FARMIQ_SYSTEM_INSTRUCTION,
        contents: [
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
