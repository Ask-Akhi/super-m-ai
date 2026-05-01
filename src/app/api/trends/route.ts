import { NextRequest, NextResponse } from 'next/server';
import { getPriceHistory } from '@/lib/db';
import { generateTrendData, normalizeTrendDate, normalizeTrendPoints } from '@/lib/trends';
import { PriceTrendPoint, ProductResult, RetailerName } from '@/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { productName?: string; results?: ProductResult[] };

    // Prefer real DB history when a product name is provided
    if (body.productName) {
      const history = getPriceHistory(body.productName, undefined, 12);
      if (history.length > 0) {
        const trends = normalizeTrendPoints(history.map((h): PriceTrendPoint => ({
          date: normalizeTrendDate(h.week_bucket) ?? h.week_bucket,
          price: Math.round(h.avg_price * 100) / 100,
          retailer: h.retailer as RetailerName,
        })));
        if (trends.length > 1) {
          return NextResponse.json({ trends, source: 'db' });
        }
      }
    }

    // Fallback: generate simulated trend from current results
    if (Array.isArray(body.results) && body.results.length > 0) {
      const trends = generateTrendData(body.results);
      return NextResponse.json({ trends, source: 'simulated' });
    }

    return NextResponse.json({ trends: [], source: 'empty' });
  } catch (err: unknown) {
    console.error('Trends error:', err);
    return NextResponse.json({ error: 'Failed to generate trends' }, { status: 500 });
  }
}
