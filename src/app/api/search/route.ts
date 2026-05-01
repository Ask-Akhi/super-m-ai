import { NextRequest, NextResponse } from 'next/server';
import { runSmartSearch } from '@/lib/search-engine';
import { writePrices } from '@/lib/db';
import { getPriceHistory } from '@/lib/db';
import { PriceTrendPoint, ProductResult, RetailerName } from '@/types';
import { generateTrendData, normalizeTrendDate, normalizeTrendPoints } from '@/lib/trends';

// Vague single-word or brand-ambiguous queries that need clarification
const VAGUE_PATTERNS = [
  /^(milk|bread|eggs?|cheese|butter|yogh?urt|coffee|tea|juice|water|oil|sauce|pasta|rice|flour|sugar|salt|cereal|chips|chocolate|biscuits?|crackers?|nuts?)$/i,
  /^[a-z\s]{1,12}$/i, // very short queries under 12 chars with no brand/size qualifier
];
const HAS_QUALIFIER = /([\d]+\s*(ml|l|g|kg|L|pack|pk|x\d)|brand|original|light|full\s*cream|skim|organic|free\s*range|wholemeal|sourdough|barista|soy|almond|oat|lactose)/i;

function needsClarification(query: string): string[] | null {
  const q = query.trim().toLowerCase();
  const wordCount = q.split(/\s+/).length;
  // Already specific enough
  if (wordCount >= 4 || HAS_QUALIFIER.test(query)) return null;
  if (wordCount === 1 && VAGUE_PATTERNS[0].test(q)) {
    // Suggest refinements based on keyword
    const map: Record<string, string[]> = {
      milk: ['Full cream milk 2L', 'Skim milk 2L', 'Almond milk 1L', 'Oat milk 1L', 'Soy milk 1L'],
      bread: ['White sandwich bread', 'Wholemeal bread', 'Sourdough bread loaf', 'Multigrain bread'],
      eggs: ['Free range eggs 12 pack', 'Cage free eggs 12 pack', 'Organic eggs 12 pack'],
      cheese: ['Cheddar cheese 500g', 'Tasty cheese block 1kg', 'Mozzarella 500g'],
      coffee: ['Instant coffee 200g', 'Ground coffee 250g', 'Coffee pods 10 pack'],
      butter: ['Salted butter 500g', 'Unsalted butter 250g', 'Plant-based butter'],
      yoghurt: ['Greek yoghurt 1kg', 'Natural yoghurt 500g', 'Flavoured yoghurt 6 pack'],
      yogurt: ['Greek yoghurt 1kg', 'Natural yoghurt 500g', 'Flavoured yoghurt 6 pack'],
    };
    return map[q] ?? null;
  }
  // 2-3 word queries that look like brand names without category context
  if (wordCount <= 3 && /^[A-Z]/.test(query.trim()) && !HAS_QUALIFIER.test(query)) {
    return [
      query + ' 1L',
      query + ' 2L',
      query + ' 500ml',
      query + ' Original',
      query + ' Light',
    ];
  }
  return null;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const buildVersion = process.env.RENDER_GIT_COMMIT?.slice(0, 7)
    ?? process.env.NEXT_PUBLIC_APP_BUILD
    ?? 'local';
  try {
    const { query, skipClarification } = await req.json();
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Check if query needs clarification (unless user already confirmed)
    if (!skipClarification) {
      const opts = needsClarification(query.trim());
      if (opts) {
        const durationMs = Date.now() - startedAt;
        const response = NextResponse.json({
          clarificationNeeded: true,
          clarificationOptions: opts,
          query: query.trim(),
          meta: { durationMs, buildVersion },
        });
        response.headers.set('x-superm-build', buildVersion);
        response.headers.set('x-superm-duration-ms', String(durationMs));
        return response;
      }
    }

    // Run the smart search engine (retries, ranking, synonym expansion)
    const response = await runSmartSearch(query.trim());
    const safeResults = Array.isArray(response.results) ? response.results : [];

    // ── Persist scraped prices to local DB ───────────────────
    if (safeResults.length > 0) {
      try {
        writePrices(
          safeResults.map((r: ProductResult) => ({
            retailer: r.retailer,
            product_name: r.productName,
            price: r.price,
            unit: r.unit,
            price_per_unit: r.pricePerUnit,
            product_url: r.productUrl,
            image_url: r.imageUrl,
            source: 'scrape' as const,
            in_stock: r.inStock,
            on_sale: r.onSale,
          })),
        );
      } catch (dbErr) {
        // Non-fatal — DB write failures should not break the search response
        console.warn('[search] DB write failed:', dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }

    // ── Build trend data from DB history (real 12-week data) ─
    let trendData: PriceTrendPoint[] = [];
    try {
      const firstResult = safeResults[0];
      if (firstResult) {
        const history = getPriceHistory(firstResult.productName, undefined, 12);
        trendData = normalizeTrendPoints(history.map((h): PriceTrendPoint => ({
          date: normalizeTrendDate(h.week_bucket) ?? h.week_bucket,
          price: Math.round(h.avg_price * 100) / 100,
          retailer: h.retailer as RetailerName,
        })));
      }

      if (trendData.length < 2 && safeResults.length > 0) {
        trendData = generateTrendData(safeResults);
      }
    } catch (trendErr) {
      console.warn('[search] trend data failed:', trendErr instanceof Error ? trendErr.message : trendErr);
      if (safeResults.length > 0) {
        trendData = generateTrendData(safeResults);
      }
    }

    const durationMs = Date.now() - startedAt;
    const apiResponse = NextResponse.json({
      ...response,
      results: safeResults,
      trendData,
      meta: { durationMs, buildVersion },
    });
    apiResponse.headers.set('x-superm-build', buildVersion);
    apiResponse.headers.set('x-superm-duration-ms', String(durationMs));
    return apiResponse;
  } catch (err: unknown) {
    console.error('Search error:', err instanceof Error ? err.stack : err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const durationMs = Date.now() - startedAt;
    const errorResponse = NextResponse.json({
      error: `Search failed: ${message}`,
      meta: { durationMs, buildVersion },
    }, { status: 500 });
    errorResponse.headers.set('x-superm-build', buildVersion);
    errorResponse.headers.set('x-superm-duration-ms', String(durationMs));
    return errorResponse;
  }
}


