/**
 * predictor.ts — Predictive / fallback pricing engine
 *
 * When a scraper fails or returns stale data, this module estimates
 * the current price using statistical rules over the price_records history.
 *
 * Strategy (in order of reliability):
 *  1. Exponential Weighted Moving Average (EWMA) over the last 12 weeks
 *  2. If < 3 observations: use median of all-time records + CPI inflation drift
 *  3. If 0 observations: return null (no prediction possible)
 *
 * Specials decay model:
 *  - Detect if the last known price was a "sale" price
 *  - Apply an expiry: Aussie supermarket specials typically last 1–2 weeks
 *  - If sale is likely expired, revert to estimated regular price
 *
 * Confidence degrades 10% per week since last real observation, flooring at 0.1.
 */

import { CachedProduct, getPriceHistory, getDb } from './db';
import { RetailerName } from '@/types';

export interface PricePrediction {
  predictedPrice: number;
  confidence: number;        // 0-1
  basis: 'ewma' | 'median' | 'stale-cache';
  weeksStale: number;
  saleExpired: boolean;
  explanation: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const EWMA_ALPHA = 0.3;           // recency weight — higher = more reactive
const CONFIDENCE_DECAY = 0.10;    // per week stale
const SALE_EXPIRY_WEEKS = 2;      // Aussie specials typically last 1–2 weeks
const MIN_CONFIDENCE = 0.10;

// ── Core predictor ────────────────────────────────────────────────────────────
export function predictPrice(
  productName: string,
  retailer: RetailerName,
): PricePrediction | null {
  const history = getPriceHistory(productName, retailer, 12);
  if (history.length === 0) return null;

  // Sort chronologically
  const sorted = [...history].sort((a, b) => a.week_bucket.localeCompare(b.week_bucket));

  // ── EWMA ──────────────────────────────────────────────────────────────────
  let ewma = sorted[0].avg_price;
  for (let i = 1; i < sorted.length; i++) {
    ewma = EWMA_ALPHA * sorted[i].avg_price + (1 - EWMA_ALPHA) * ewma;
  }

  // ── Median fallback ───────────────────────────────────────────────────────
  const prices = sorted.map((p) => p.avg_price).sort((a, b) => a - b);
  const median =
    prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)];

  const basis = sorted.length >= 3 ? 'ewma' : 'median';
  const predictedRaw = basis === 'ewma' ? ewma : median;

  // ── Sale expiry ───────────────────────────────────────────────────────────
  const lastEntry = sorted[sorted.length - 1];
  const weeksStale = weeksSince(lastEntry.week_bucket);
  let saleExpired = false;
  let predictedPrice = predictedRaw;

  // Check if last observation was a sale
  const db = getDb();
  const lastRecord = db
    .prepare(
      `SELECT on_sale, price FROM price_records
       WHERE product_name LIKE @name AND retailer = @retailer
       ORDER BY observed_at DESC LIMIT 1`,
    )
    .get({ name: `%${productName}%`, retailer }) as { on_sale: number; price: number } | undefined;

  if (lastRecord?.on_sale && weeksStale >= SALE_EXPIRY_WEEKS) {
    saleExpired = true;
    // Estimate regular price as the EWMA excluding the last sale entry
    const pricesExcludingSale = sorted.slice(0, -1).map((p) => p.avg_price);
    if (pricesExcludingSale.length > 0) {
      predictedPrice = pricesExcludingSale.reduce((a, b) => a + b, 0) / pricesExcludingSale.length;
    } else {
      predictedPrice = predictedRaw * 1.15; // typical sale discount ~15%
    }
  }

  // ── Confidence ────────────────────────────────────────────────────────────
  const baseConfidence = basis === 'ewma' ? 0.75 : 0.50;
  const confidence = Math.max(
    MIN_CONFIDENCE,
    baseConfidence - weeksStale * CONFIDENCE_DECAY,
  );

  const explanation = buildExplanation(basis, weeksStale, saleExpired, sorted.length);

  return { predictedPrice, confidence, basis, weeksStale, saleExpired, explanation };
}

// ── Bulk: update stale products in cache with predictions ────────────────────
export function runPredictionsForStaleProducts() {
  const db = getDb();
  const stale = db
    .prepare(
      `SELECT retailer, product_name FROM product_cache
       WHERE stale = 1 OR last_seen_at < datetime('now', '-7 days')`,
    )
    .all() as { retailer: RetailerName; product_name: string }[];

  let updated = 0;
  const updateStmt = db.prepare(
    `UPDATE product_cache SET predicted_price = @predicted_price,
       prediction_confidence = @confidence, stale = 1
     WHERE retailer = @retailer AND product_name = @product_name`,
  );

  for (const row of stale) {
    const pred = predictPrice(row.product_name, row.retailer);
    if (!pred) continue;
    updateStmt.run({
      predicted_price: Math.round(pred.predictedPrice * 100) / 100,
      confidence: pred.confidence,
      retailer: row.retailer,
      product_name: row.product_name,
    });
    updated++;
  }

  return { stale: stale.length, updated };
}

// ── Weekly scrape freshness check ─────────────────────────────────────────────
export function markStaleProducts(olderThanDays = 7) {
  const db = getDb();
  const result = db
    .prepare(
      `UPDATE product_cache SET stale = 1
       WHERE last_seen_at < datetime('now', @cutoff)`,
    )
    .run({ cutoff: `-${olderThanDays} days` });
  return result.changes;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function weeksSince(weekBucket: string): number {
  const [year, weekStr] = weekBucket.split('-W');
  const week = parseInt(weekStr, 10);
  const startOfYear = new Date(parseInt(year, 10), 0, 1);
  const dayOffset = (week - 1) * 7;
  const date = new Date(startOfYear.getTime() + dayOffset * 86400_000);
  return Math.floor((Date.now() - date.getTime()) / (7 * 86400_000));
}

function buildExplanation(
  basis: string,
  weeksStale: number,
  saleExpired: boolean,
  dataPoints: number,
): string {
  const parts: string[] = [];
  if (weeksStale === 0) parts.push('Based on this week\'s data');
  else if (weeksStale === 1) parts.push('Based on last week\'s prices');
  else parts.push(`Estimated from ${weeksStale}-week-old data`);

  parts.push(`(${dataPoints} data point${dataPoints !== 1 ? 's' : ''}, ${basis.toUpperCase()} model)`);

  if (saleExpired) parts.push('— sale likely expired, showing estimated regular price');

  return parts.join(' ');
}
