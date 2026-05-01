/**
 * db.ts — SQLite price database
 *
 * Three tables:
 *  price_records  — every scraped or receipt-contributed price observation
 *  product_cache  — deduplicated canonical product rows with freshness metadata
 *  receipt_submissions — raw receipt OCR jobs + gamification scores
 *
 * On Vercel / serverless, writes go to /tmp (ephemeral). For local dev the DB
 * persists at <project-root>/data/prices.db so data survives hot-reloads.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { RetailerName } from '@/types';

// ── Path ─────────────────────────────────────────────────────────────────────
const DATA_DIR =
  process.env.DATA_DIR
    ?? process.env.RENDER_DISK_MOUNT_PATH
    ?? (process.env.NODE_ENV === 'production'
      ? '/tmp'
      : path.join(process.cwd(), 'data'));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'prices.db');

// ── Singleton ─────────────────────────────────────────────────────────────────
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  migrate(_db);
  return _db;
}

// ── Schema ────────────────────────────────────────────────────────────────────
function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS price_records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      retailer      TEXT    NOT NULL,
      product_name  TEXT    NOT NULL,
      price         REAL    NOT NULL,
      unit          TEXT,
      price_per_unit REAL,
      product_url   TEXT,
      image_url     TEXT,
      source        TEXT    NOT NULL CHECK(source IN ('scrape','receipt','manual')),
      confidence    REAL    NOT NULL DEFAULT 1.0,   -- 0-1, receipts = 0.98, scrapes = 0.85
      in_stock      INTEGER NOT NULL DEFAULT 1,
      on_sale       INTEGER NOT NULL DEFAULT 0,
      observed_at   TEXT    NOT NULL,
      week_bucket   TEXT    NOT NULL  -- ISO week e.g. "2026-W18" for easy trend grouping
    );

    CREATE INDEX IF NOT EXISTS idx_pr_retailer_name ON price_records(retailer, product_name);
    CREATE INDEX IF NOT EXISTS idx_pr_week ON price_records(week_bucket);

    CREATE TABLE IF NOT EXISTS product_cache (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      retailer        TEXT    NOT NULL,
      product_name    TEXT    NOT NULL,
      canonical_name  TEXT,               -- LLM-normalised name e.g. "Full Cream Milk 2L"
      current_price   REAL    NOT NULL,
      previous_price  REAL,
      price_source    TEXT    NOT NULL DEFAULT 'scrape',
      last_seen_at    TEXT    NOT NULL,
      scraped_at      TEXT,               -- last successful scrape time
      receipt_count   INTEGER NOT NULL DEFAULT 0,
      stale           INTEGER NOT NULL DEFAULT 0, -- 1 if last scrape > 7 days ago
      predicted_price REAL,               -- fallback prediction
      prediction_confidence REAL,
      product_url     TEXT,
      image_url       TEXT,
      UNIQUE(retailer, product_name)
    );

    CREATE INDEX IF NOT EXISTS idx_pc_canonical ON product_cache(canonical_name);
    CREATE INDEX IF NOT EXISTS idx_pc_retailer ON product_cache(retailer);

    CREATE TABLE IF NOT EXISTS receipt_submissions (
      id              TEXT    PRIMARY KEY,  -- uuid
      user_token      TEXT    NOT NULL,     -- anonymous session token
      retailer        TEXT,
      image_path      TEXT    NOT NULL,
      raw_ocr_text    TEXT,
      parsed_items    TEXT,               -- JSON array of {name,price,qty}
      status          TEXT    NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','processing','done','failed')),
      items_validated INTEGER NOT NULL DEFAULT 0,
      savings_points  INTEGER NOT NULL DEFAULT 0,
      submitted_at    TEXT    NOT NULL,
      processed_at    TEXT
    );
  `);
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface PriceRecord {
  retailer: RetailerName;
  product_name: string;
  price: number;
  unit?: string;
  price_per_unit?: number;
  product_url?: string;
  image_url?: string;
  source: 'scrape' | 'receipt' | 'manual';
  confidence?: number;
  in_stock?: boolean;
  on_sale?: boolean;
  observed_at?: string;
}

export interface CachedProduct {
  retailer: RetailerName;
  product_name: string;
  canonical_name?: string;
  current_price: number;
  previous_price?: number;
  price_source: string;
  last_seen_at: string;
  scraped_at?: string;
  receipt_count: number;
  stale: boolean;
  predicted_price?: number;
  prediction_confidence?: number;
  product_url?: string;
  image_url?: string;
}

export interface ReceiptItem {
  name: string;
  canonical?: string;
  price: number;
  qty?: number;
  unit?: string;
  on_sale?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const week = Math.ceil(((+d - +new Date(Date.UTC(year, 0, 1))) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Upsert a batch of price observations (from scraper or receipt).
 * Also updates product_cache for fast lookups.
 */
export function writePrices(records: PriceRecord[]) {
  const db = getDb();
  const now = new Date().toISOString();
  const week = isoWeek();

  const insertRecord = db.prepare(`
    INSERT INTO price_records
      (retailer, product_name, price, unit, price_per_unit, product_url, image_url,
       source, confidence, in_stock, on_sale, observed_at, week_bucket)
    VALUES
      (@retailer, @product_name, @price, @unit, @price_per_unit, @product_url, @image_url,
       @source, @confidence, @in_stock, @on_sale, @observed_at, @week_bucket)
  `);

  const upsertCache = db.prepare(`
    INSERT INTO product_cache
      (retailer, product_name, current_price, previous_price, price_source,
       last_seen_at, scraped_at, receipt_count, stale, product_url, image_url)
    VALUES
      (@retailer, @product_name, @current_price, @previous_price, @price_source,
       @last_seen_at, @scraped_at, @receipt_count, 0, @product_url, @image_url)
    ON CONFLICT(retailer, product_name) DO UPDATE SET
      previous_price = current_price,
      current_price  = excluded.current_price,
      price_source   = excluded.price_source,
      last_seen_at   = excluded.last_seen_at,
      scraped_at     = CASE WHEN excluded.price_source = 'scrape' THEN excluded.last_seen_at ELSE scraped_at END,
      receipt_count  = receipt_count + CASE WHEN excluded.price_source = 'receipt' THEN 1 ELSE 0 END,
      stale          = 0,
      product_url    = COALESCE(excluded.product_url, product_url),
      image_url      = COALESCE(excluded.image_url, image_url)
  `);

  const runAll = db.transaction((recs: PriceRecord[]) => {
    for (const r of recs) {
      insertRecord.run({
        retailer: r.retailer,
        product_name: r.product_name,
        price: r.price,
        unit: r.unit ?? null,
        price_per_unit: r.price_per_unit ?? null,
        product_url: r.product_url ?? null,
        image_url: r.image_url ?? null,
        source: r.source,
        confidence: r.confidence ?? (r.source === 'receipt' ? 0.98 : 0.85),
        in_stock: r.in_stock !== false ? 1 : 0,
        on_sale: r.on_sale ? 1 : 0,
        observed_at: r.observed_at ?? now,
        week_bucket: week,
      });
      upsertCache.run({
        retailer: r.retailer,
        product_name: r.product_name,
        current_price: r.price,
        previous_price: null,
        price_source: r.source,
        last_seen_at: r.observed_at ?? now,
        scraped_at: r.source === 'scrape' ? (r.observed_at ?? now) : null,
        receipt_count: r.source === 'receipt' ? 1 : 0,
        product_url: r.product_url ?? null,
        image_url: r.image_url ?? null,
      });
    }
  });

  runAll(records);
}

// ── Read: price history for trend charts ─────────────────────────────────────
export function getPriceHistory(
  productName: string,
  retailer?: RetailerName,
  weeks = 12,
): { week_bucket: string; avg_price: number; retailer: string }[] {
  const db = getDb();
  const cutoff = isoWeekMinus(weeks);
  if (retailer) {
    return db
      .prepare(
        `SELECT week_bucket, AVG(price) as avg_price, retailer
         FROM price_records
         WHERE product_name LIKE @name AND retailer = @retailer AND week_bucket >= @cutoff
         GROUP BY week_bucket, retailer
         ORDER BY week_bucket`,
      )
      .all({ name: `%${productName}%`, retailer, cutoff }) as { week_bucket: string; avg_price: number; retailer: string }[];
  }
  return db
    .prepare(
      `SELECT week_bucket, AVG(price) as avg_price, retailer
       FROM price_records
       WHERE product_name LIKE @name AND week_bucket >= @cutoff
       GROUP BY week_bucket, retailer
       ORDER BY week_bucket`,
    )
    .all({ name: `%${productName}%`, cutoff }) as { week_bucket: string; avg_price: number; retailer: string }[];
}

function isoWeekMinus(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return isoWeek(d);
}

// ── Read: stale products (for predictive pricing) ─────────────────────────────
export function getStaleProducts(olderThanDays = 7): CachedProduct[] {
  const db = getDb();
  const cutoff = new Date(Date.now() - olderThanDays * 86400_000).toISOString();
  return db
    .prepare(
      `SELECT * FROM product_cache
       WHERE last_seen_at < @cutoff OR stale = 1`,
    )
    .all({ cutoff }) as CachedProduct[];
}

// ── Read: search cache (fast lookup before hitting live scrapers) ──────────────
export function searchCache(
  query: string,
  maxAgeDays = 7,
): CachedProduct[] {
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeDays * 86400_000).toISOString();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `%${t}%`);
  if (terms.length === 0) return [];

  // Build a LIKE clause per term on canonical_name or product_name
  const clauses = terms.map(() => `(LOWER(canonical_name) LIKE ? OR LOWER(product_name) LIKE ?)`).join(' AND ');
  const params = terms.flatMap((t) => [t, t]);
  params.push(cutoff);

  return db
    .prepare(
      `SELECT * FROM product_cache
       WHERE (${clauses}) AND last_seen_at >= ?
       ORDER BY current_price ASC
       LIMIT 50`,
    )
    .all(...params) as CachedProduct[];
}

// ── Receipt submissions ───────────────────────────────────────────────────────
export function createReceiptSubmission(id: string, userToken: string, imagePath: string, retailer?: string) {
  const db = getDb();
  db.prepare(
    `INSERT INTO receipt_submissions (id, user_token, retailer, image_path, status, submitted_at)
     VALUES (@id, @user_token, @retailer, @image_path, 'pending', @submitted_at)`,
  ).run({ id, user_token: userToken, retailer: retailer ?? null, image_path: imagePath, submitted_at: new Date().toISOString() });
}

export function updateReceiptResult(
  id: string,
  opts: { rawOcrText?: string; parsedItems?: ReceiptItem[]; status: string; savingsPoints?: number; itemsValidated?: number },
) {
  const db = getDb();
  db.prepare(
    `UPDATE receipt_submissions SET
       raw_ocr_text    = COALESCE(@raw_ocr_text, raw_ocr_text),
       parsed_items    = COALESCE(@parsed_items, parsed_items),
       status          = @status,
       savings_points  = COALESCE(@savings_points, savings_points),
       items_validated = COALESCE(@items_validated, items_validated),
       processed_at    = @processed_at
     WHERE id = @id`,
  ).run({
    id,
    raw_ocr_text: opts.rawOcrText ?? null,
    parsed_items: opts.parsedItems ? JSON.stringify(opts.parsedItems) : null,
    status: opts.status,
    savings_points: opts.savingsPoints ?? null,
    items_validated: opts.itemsValidated ?? null,
    processed_at: new Date().toISOString(),
  });
}

export function getReceiptSubmission(id: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM receipt_submissions WHERE id = @id`).get({ id });
}

// ── Leaderboard helpers ───────────────────────────────────────────────────────
export function getUserStats(userToken: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         COUNT(*) as receipts_scanned,
         SUM(savings_points) as total_points,
         SUM(items_validated) as items_contributed
       FROM receipt_submissions
       WHERE user_token = @userToken AND status = 'done'`,
    )
    .get({ userToken }) as { receipts_scanned: number; total_points: number; items_contributed: number } | undefined;
}

export function getLeaderboard(limit = 10) {
  const db = getDb();
  return db
    .prepare(
      `SELECT user_token, SUM(savings_points) as total_points, COUNT(*) as receipts
       FROM receipt_submissions
       WHERE status = 'done'
       GROUP BY user_token
       ORDER BY total_points DESC
       LIMIT @limit`,
    )
    .all({ limit }) as { user_token: string; total_points: number; receipts: number }[];
}
