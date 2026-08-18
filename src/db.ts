import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFilePath = path.join(dataDir, 'feedbacks.json');

export interface FeedbackInput {
  name?: string;
  contact?: string;
  category: string;
  rating: number;
  message: string;
  ip_address?: string;
  user_agent?: string;
}

export interface FeedbackRecord {
  id: number;
  name: string | null;
  contact: string | null;
  category: string;
  rating: number;
  message: string;
  status: 'unread' | 'reviewed' | 'resolved';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface FeedbackStats {
  total: number;
  unread: number;
  reviewed: number;
  resolved: number;
  averageRating: number;
  byCategory: Record<string, number>;
  byRating: Record<number, number>;
}

// In-memory store with atomic disk persistence
let feedbacksCache: FeedbackRecord[] = [];
let nextId = 1;

function loadFromDisk(): void {
  try {
    if (fs.existsSync(dbFilePath)) {
      const rawData = fs.readFileSync(dbFilePath, 'utf-8');
      const parsed = JSON.parse(rawData);
      if (Array.isArray(parsed)) {
        feedbacksCache = parsed;
        const maxId = feedbacksCache.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
        nextId = maxId + 1;
        return;
      }
    }
  } catch (err) {
    console.error('Warning: Failed to read feedbacks store, initializing new store:', err);
  }
  feedbacksCache = [];
  nextId = 1;
  saveToDisk();
}

function saveToDisk(): void {
  try {
    const tempPath = `${dbFilePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(feedbacksCache, null, 2), 'utf-8');
    fs.renameSync(tempPath, dbFilePath);
  } catch (err) {
    console.error('Error saving feedbacks to disk:', err);
  }
}

// Initialize on startup
loadFromDisk();

export const dbService = {
  // Insert new feedback from user
  insertFeedback(input: FeedbackInput): FeedbackRecord {
    const cleanName = input.name?.trim() || 'Petani Anonim';
    const cleanContact = input.contact?.trim() || null;
    const cleanCategory = input.category?.trim() || 'Saran Fitur';
    const cleanRating = Math.max(1, Math.min(5, Number(input.rating) || 5));
    const cleanMessage = input.message?.trim();

    if (!cleanMessage) {
      throw new Error('Pesan masukan tidak boleh kosong.');
    }

    const now = new Date();
    const formattedDate = now.toISOString().replace('T', ' ').substring(0, 19);

    const newRecord: FeedbackRecord = {
      id: nextId++,
      name: cleanName,
      contact: cleanContact,
      category: cleanCategory,
      rating: cleanRating,
      message: cleanMessage,
      status: 'unread',
      ip_address: input.ip_address || null,
      user_agent: input.user_agent || null,
      created_at: formattedDate
    };

    feedbacksCache.unshift(newRecord);
    saveToDisk();

    return newRecord;
  },

  // Get all feedbacks with optional filters
  getAllFeedbacks(options?: { status?: string; category?: string; search?: string }): FeedbackRecord[] {
    let result = [...feedbacksCache];

    if (options?.status && options.status !== 'all') {
      result = result.filter(f => f.status === options.status);
    }

    if (options?.category && options.category !== 'all') {
      result = result.filter(f => f.category === options.category);
    }

    if (options?.search && options.search.trim()) {
      const term = options.search.trim().toLowerCase();
      result = result.filter(f =>
        (f.name && f.name.toLowerCase().includes(term)) ||
        (f.message && f.message.toLowerCase().includes(term)) ||
        (f.contact && f.contact.toLowerCase().includes(term))
      );
    }

    return result;
  },

  // Update status (unread, reviewed, resolved)
  updateStatus(id: number, status: 'unread' | 'reviewed' | 'resolved'): boolean {
    const index = feedbacksCache.findIndex(f => f.id === id);
    if (index !== -1) {
      feedbacksCache[index].status = status;
      saveToDisk();
      return true;
    }
    return false;
  },

  // Delete feedback
  deleteFeedback(id: number): boolean {
    const initialLen = feedbacksCache.length;
    feedbacksCache = feedbacksCache.filter(f => f.id !== id);
    if (feedbacksCache.length !== initialLen) {
      saveToDisk();
      return true;
    }
    return false;
  },

  // Get feedback statistics for dashboard overview
  getStats(): FeedbackStats {
    const total = feedbacksCache.length;
    let unread = 0;
    let reviewed = 0;
    let resolved = 0;
    let ratingSum = 0;

    const byCategory: Record<string, number> = {};
    const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    feedbacksCache.forEach(f => {
      if (f.status === 'unread') unread++;
      else if (f.status === 'reviewed') reviewed++;
      else if (f.status === 'resolved') resolved++;

      ratingSum += f.rating;
      byRating[f.rating] = (byRating[f.rating] || 0) + 1;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    });

    const averageRating = total > 0 ? Number((ratingSum / total).toFixed(2)) : 5.0;

    return {
      total,
      unread,
      reviewed,
      resolved,
      averageRating,
      byCategory,
      byRating
    };
  },

  // Export feedbacks in JSON or CSV format
  exportFeedbacks(format: 'json' | 'csv' = 'json'): { mimeType: string; filename: string; content: string } {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').substring(0, 14);

    if (format === 'csv') {
      const headers = ['id', 'name', 'contact', 'category', 'rating', 'message', 'status', 'ip_address', 'user_agent', 'created_at'];
      const escapeCSV = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = feedbacksCache.map(r => [
        r.id,
        escapeCSV(r.name),
        escapeCSV(r.contact),
        escapeCSV(r.category),
        r.rating,
        escapeCSV(r.message),
        escapeCSV(r.status),
        escapeCSV(r.ip_address),
        escapeCSV(r.user_agent),
        escapeCSV(r.created_at)
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\r\n');

      return {
        mimeType: 'text/csv; charset=utf-8',
        filename: `farmiq-feedbacks-${timestamp}.csv`,
        content: csvContent
      };
    }

    return {
      mimeType: 'application/json; charset=utf-8',
      filename: `farmiq-feedbacks-${timestamp}.json`,
      content: JSON.stringify(feedbacksCache, null, 2)
    };
  },

  // Parse CSV string into array of records
  parseCSV(csvText: string): Array<Record<string, string>> {
    const lines: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(field => field.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field.length > 0)) {
        lines.push(currentRow);
      }
    }

    if (lines.length === 0) return [];

    const headers = lines[0].map(h => h.toLowerCase().replace(/^["']|["']$/g, '').trim());
    const records: Array<Record<string, string>> = [];

    for (let r = 1; r < lines.length; r++) {
      const row = lines[r];
      const obj: Record<string, string> = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx] !== undefined ? row[idx] : '';
      });
      records.push(obj);
    }

    return records;
  },

  // Import feedbacks from array of raw objects (supports merge or replace)
  importFeedbacks(
    rawRecords: Array<Record<string, unknown>>,
    mode: 'merge' | 'replace' = 'merge'
  ): { importedCount: number; totalCount: number; mode: string } {
    if (!Array.isArray(rawRecords)) {
      throw new Error('Data impor harus berupa daftar array masukan.');
    }

    const validRecords: FeedbackRecord[] = [];
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    for (const raw of rawRecords) {
      const message = String(raw.message || raw.pesan || raw.Message || raw.Pesan || '').trim();
      if (!message) continue; // skip invalid empty message

      const name = raw.name || raw.nama || raw.Name || raw.Nama ? String(raw.name || raw.nama || raw.Name || raw.Nama).trim() : null;
      const contact = raw.contact || raw.kontak || raw.telepon || raw.whatsapp || raw.Contact || raw.Kontak
        ? String(raw.contact || raw.kontak || raw.telepon || raw.whatsapp || raw.Contact || raw.Kontak).trim()
        : null;
      const category = raw.category || raw.kategori || raw.Category || raw.Kategori
        ? String(raw.category || raw.kategori || raw.Category || raw.Kategori).trim()
        : 'Saran Fitur';
      const rawRating = Number(raw.rating || raw.nilai || raw.Rating || raw.Nilai) || 5;
      const rating = Math.max(1, Math.min(5, rawRating));

      let status: 'unread' | 'reviewed' | 'resolved' = 'unread';
      const rawStatus = String(raw.status || raw.Status || '').toLowerCase().trim();
      if (rawStatus === 'reviewed' || rawStatus === 'ditelaah') status = 'reviewed';
      else if (rawStatus === 'resolved' || rawStatus === 'selesai') status = 'resolved';

      const createdAt = raw.created_at || raw.createdAt || raw.tanggal || raw.Created_at
        ? String(raw.created_at || raw.createdAt || raw.tanggal || raw.Created_at).trim()
        : now;
      const ipAddress = raw.ip_address || raw.ipAddress ? String(raw.ip_address || raw.ipAddress).trim() : null;
      const userAgent = raw.user_agent || raw.userAgent ? String(raw.user_agent || raw.userAgent).trim() : null;

      const recordId = Number(raw.id || raw.ID || raw.Id) || 0;

      validRecords.push({
        id: recordId,
        name: name || null,
        contact: contact || null,
        category,
        rating,
        message,
        status,
        ip_address: ipAddress,
        user_agent: userAgent,
        created_at: createdAt
      });
    }

    if (validRecords.length === 0) {
      throw new Error('Tidak ada baris data masukan yang valid untuk diimpor. Pastikan kolom "message" atau "pesan" terisi.');
    }

    if (mode === 'replace') {
      let currentNextId = 1;
      feedbacksCache = validRecords.map(r => {
        const assignedId = r.id > 0 ? r.id : currentNextId++;
        currentNextId = Math.max(currentNextId, assignedId + 1);
        return { ...r, id: assignedId };
      });
      nextId = currentNextId;
    } else {
      // Merge mode
      let currentNextId = feedbacksCache.reduce((max, f) => Math.max(max, f.id), 0) + 1;
      const existingIds = new Set(feedbacksCache.map(f => f.id));

      for (const rec of validRecords) {
        let finalId = rec.id;
        if (finalId <= 0 || existingIds.has(finalId)) {
          finalId = currentNextId++;
        } else {
          currentNextId = Math.max(currentNextId, finalId + 1);
        }
        existingIds.add(finalId);
        feedbacksCache.push({ ...rec, id: finalId });
      }
      nextId = currentNextId;
    }

    // Sort descending by id
    feedbacksCache.sort((a, b) => b.id - a.id);

    saveToDisk();

    return {
      importedCount: validRecords.length,
      totalCount: feedbacksCache.length,
      mode
    };
  }
};
