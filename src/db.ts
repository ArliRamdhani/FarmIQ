import Database from 'better-sqlite3';
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

const dbPath = path.join(dataDir, 'farmiq.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    contact TEXT,
    category TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread',
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status);
  CREATE INDEX IF NOT EXISTS idx_feedbacks_category ON feedbacks(category);
`);

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

    const stmt = db.prepare(`
      INSERT INTO feedbacks (name, contact, category, rating, message, status, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, 'unread', ?, ?)
    `);

    const result = stmt.run(
      cleanName,
      cleanContact,
      cleanCategory,
      cleanRating,
      cleanMessage,
      input.ip_address || null,
      input.user_agent || null
    );

    const insertedId = Number(result.lastInsertRowid);
    const created = db.prepare('SELECT * FROM feedbacks WHERE id = ?').get(insertedId) as unknown as FeedbackRecord;
    return created;
  },

  // Get all feedbacks with optional filters
  getAllFeedbacks(options?: { status?: string; category?: string; search?: string }): FeedbackRecord[] {
    let sql = 'SELECT * FROM feedbacks WHERE 1=1';
    const params: (string | number)[] = [];

    if (options?.status && options.status !== 'all') {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    if (options?.category && options.category !== 'all') {
      sql += ' AND category = ?';
      params.push(options.category);
    }

    if (options?.search && options.search.trim()) {
      sql += ' AND (name LIKE ? OR message LIKE ? OR contact LIKE ?)';
      const term = `%${options.search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = db.prepare(sql);
    return stmt.all(...params) as unknown as FeedbackRecord[];
  },

  // Update status (unread, reviewed, resolved)
  updateStatus(id: number, status: 'unread' | 'reviewed' | 'resolved'): boolean {
    const stmt = db.prepare('UPDATE feedbacks SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);
    return Number(result.changes) > 0;
  },

  // Delete feedback
  deleteFeedback(id: number): boolean {
    const stmt = db.prepare('DELETE FROM feedbacks WHERE id = ?');
    const result = stmt.run(id);
    return Number(result.changes) > 0;
  },

  // Get feedback statistics for dashboard overview
  getStats(): FeedbackStats {
    const totalRow = (db.prepare('SELECT COUNT(*) as count, AVG(rating) as avgRating FROM feedbacks').get() || {}) as { count?: number; avgRating?: number | null };
    const unreadRow = (db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE status = 'unread'").get() || {}) as { count?: number };
    const reviewedRow = (db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE status = 'reviewed'").get() || {}) as { count?: number };
    const resolvedRow = (db.prepare("SELECT COUNT(*) as count FROM feedbacks WHERE status = 'resolved'").get() || {}) as { count?: number };

    const categoryRows = (db.prepare('SELECT category, COUNT(*) as count FROM feedbacks GROUP BY category').all() || []) as unknown as Array<{ category: string; count: number }>;
    const ratingRows = (db.prepare('SELECT rating, COUNT(*) as count FROM feedbacks GROUP BY rating').all() || []) as unknown as Array<{ rating: number; count: number }>;

    const byCategory: Record<string, number> = {};
    categoryRows.forEach(row => {
      byCategory[row.category] = Number(row.count);
    });

    const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingRows.forEach(row => {
      byRating[Number(row.rating)] = Number(row.count);
    });

    const totalCount = Number(totalRow.count || 0);
    const avgRatingVal = totalRow.avgRating !== undefined && totalRow.avgRating !== null ? Number(Number(totalRow.avgRating).toFixed(2)) : 5.0;

    return {
      total: totalCount,
      unread: Number(unreadRow.count || 0),
      reviewed: Number(reviewedRow.count || 0),
      resolved: Number(resolvedRow.count || 0),
      averageRating: avgRatingVal,
      byCategory,
      byRating
    };
  }
};
