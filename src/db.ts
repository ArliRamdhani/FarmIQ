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
  }
};
