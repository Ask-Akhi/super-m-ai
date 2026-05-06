import { PriceTrendPoint, ProductResult, RetailerName } from '@/types';

function isIsoDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoWeekToDate(weekBucket: string): string | null {
  const match = weekBucket.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  if (Number.isNaN(year) || Number.isNaN(week) || week < 1 || week > 53) return null;

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);

  const target = new Date(mondayOfWeek1);
  target.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);
  return target.toISOString().split('T')[0];
}

export function normalizeTrendDate(value: string): string | null {
  if (!value) return null;
  if (isIsoDateString(value)) return value;
  return isoWeekToDate(value);
}

export function normalizeTrendPoints(trendData: PriceTrendPoint[]): PriceTrendPoint[] {
  return trendData
    .map((point) => {
      const normalizedDate = normalizeTrendDate(point.date);
      if (!normalizedDate || Number.isNaN(point.price)) return null;
      return {
        ...point,
        date: normalizedDate,
      };
    })
    .filter((point): point is PriceTrendPoint => point !== null);
}

// In a production app this would query a database.
// Generates deterministic (not random) mock data so the chart is stable across
// server-side renders and page reloads. Uses a simple hash of retailer+week.
function deterministicVariation(retailer: string, weekOffset: number): number {
  let hash = 0;
  const seed = `${retailer}:${weekOffset}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // Map to ±8% range
  return ((hash % 1000) / 1000 - 0.5) * 0.16;
}

export function generateTrendData(results: ProductResult[]): PriceTrendPoint[] {
  if (results.length === 0) return [];

  const today = new Date();
  const trendPoints: PriceTrendPoint[] = [];

  const retailerMap = new Map<RetailerName, number>();
  for (const r of results) {
    if (!retailerMap.has(r.retailer)) {
      retailerMap.set(r.retailer, r.price);
    }
  }

  retailerMap.forEach((currentPrice, retailer) => {
    for (let week = 11; week >= 0; week--) {
      const date = new Date(today);
      date.setDate(date.getDate() - week * 7);
      const variation = deterministicVariation(retailer, week);
      const historicalPrice = Math.max(0.5, parseFloat((currentPrice * (1 + variation)).toFixed(2)));
      trendPoints.push({
        date: date.toISOString().split('T')[0],
        price: historicalPrice,
        retailer,
      });
    }
  });

  return normalizeTrendPoints(trendPoints);
}

export function getTrendDataForChart(
  trendData: PriceTrendPoint[]
): { date: string; [retailer: string]: number | string }[] {
  const normalizedTrendData = normalizeTrendPoints(trendData);
  const dateMap = new Map<string, { date: string; [k: string]: number | string }>();

  for (const point of normalizedTrendData) {
    if (!dateMap.has(point.date)) {
      dateMap.set(point.date, { date: point.date });
    }
    const entry = dateMap.get(point.date)!;
    entry[point.retailer] = point.price;
  }

  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}
