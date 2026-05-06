import { ProductResult, RetailerName, RetailerSearchStatus, SearchResponse } from '@/types';
import { scrapeRetailerWithStatus, ScraperResult } from './scrapers';
import { searchCache } from './db';
import {
  buildDerivedQueries,
  dedupeResults,
  GENERAL_RETAILERS,
  generateQueryVariants,
  GROCERY_FIRST_RETAILERS,
  isStapleGroceryQuery,
  MARKETPLACE_RETAILERS,
  MIXED_RETAILERS,
  normalizeText,
  rankRetailerResults,
  scoreProduct,
  tokenize,
  unique,
} from './search-intelligence';

const INITIAL_RETAILER_TIMEOUT_MS = 8000;
const CORE_SUPERMARKET_TIMEOUT_MS = 10000;
const RETRY_RETAILER_TIMEOUT_MS = 6000;
const CORE_SUPERMARKET_RETRY_TIMEOUT_MS = 7000;
const MAX_RETRY_VARIANTS = 4; // fewer variants = fewer parallel fetches but still covers common cases
const RETRYABLE_RETAILERS = new Set<RetailerName>([
  'Coles',
  'Woolworths',
  'Aldi',
  'IGA',
  'Costco',
  'Harris Farm',
  'Big W',
]);
const CORE_SUPERMARKET_RETAILERS = new Set<RetailerName>(['Coles', 'Woolworths', 'Aldi', 'IGA']);

const ALL_RETAILERS: RetailerName[] = [
  'Coles',
  'Woolworths',
  'Aldi',
  'IGA',
  'Costco',
  'Harris Farm',
  'Amazon AU',
  'Target',
  'Officeworks',
  'Big W',
  'Kmart',
  'Chemist Warehouse',
  'Priceline',
];

function pickBestAttempt(attempts: ScraperResult[], query: string): ScraperResult {
  return attempts.reduce((best, current) => {
    const bestTop = rankRetailerResults(best.results, query)[0];
    const currentTop = rankRetailerResults(current.results, query)[0];
    const bestScore = bestTop ? scoreProduct(bestTop, query) : -Infinity;
    const currentScore = currentTop ? scoreProduct(currentTop, query) : -Infinity;

    if (currentScore > bestScore) return current;
    if (currentScore === bestScore && current.results.length > best.results.length) return current;
    return best;
  });
}

async function timeboxedRetailerSearch(
  retailer: RetailerName,
  query: string,
  timeoutMs: number,
): Promise<ScraperResult> {
  const timeout = new Promise<ScraperResult>((resolve) => {
    setTimeout(() => {
      resolve({
        retailer,
        results: [],
        status: 'error',
        message: `Timed out after ${Math.round(timeoutMs / 1000)}s`,
        detailCode: 'timed_out',
      });
    }, timeoutMs);
  });

  return Promise.race([
    scrapeRetailerWithStatus(retailer, query),
    timeout,
  ]);
}

function getInitialTimeoutForRetailer(retailer: RetailerName): number {
  return CORE_SUPERMARKET_RETAILERS.has(retailer) ? CORE_SUPERMARKET_TIMEOUT_MS : INITIAL_RETAILER_TIMEOUT_MS;
}

function getCachedRetailerFallback(retailer: RetailerName, variants: string[], query: string): ScraperResult | null {
  const cachedResults = dedupeResults(
    variants.flatMap((variant) => searchCache(variant, 45))
      .filter((item) => item.retailer === retailer)
      .map((item): ProductResult => ({
        retailer,
        productName: item.canonical_name ?? item.product_name,
        price: item.current_price,
        originalPrice: item.previous_price && item.previous_price > item.current_price ? item.previous_price : undefined,
        unit: undefined,
        imageUrl: item.image_url ?? undefined,
        productUrl: item.product_url ?? '#',
        inStock: true,
        onSale: !!(item.previous_price && item.previous_price > item.current_price),
        scrapedAt: item.last_seen_at,
        storeLocation: 'Cached retailer history',
        storeBranch: 'Fallback data',
      })),
  );

  const rankedCachedResults = rankRetailerResults(cachedResults, query).slice(0, 4);
  if (rankedCachedResults.length === 0) return null;

  return {
    retailer,
    results: rankedCachedResults.map((result) => ({ ...result, sourceType: 'cached_fallback' })),
    status: 'ok',
    message: 'Using cached retailer fallback because the live search returned no strong result.',
    detailCode: 'cached_fallback',
  };
}

function toRetailerStatus(result: ScraperResult, query: string): RetailerSearchStatus {
  const ranked = rankRetailerResults(result.results, query);
  return {
    retailer: result.retailer,
    status: ranked.length > 0 ? 'ok' : (result.status === 'ok' ? 'empty' : result.status),
    count: ranked.slice(0, 4).length,
    message: result.message,
    detailCode: result.detailCode,
  };
}

function buildInsights(query: string, ranked: ProductResult[], cheapest: ProductResult | null, statuses: RetailerSearchStatus[]): string[] {
  const insights: string[] = [];
  // Use cheapest as headline, not ranked[0] (ranked[0] may be a multipack or best-match not cheapest)
  const headlineMatch = cheapest ?? ranked[0] ?? null;
  const bestMatch = ranked[0] ?? null;
  const topScore = bestMatch ? scoreProduct(bestMatch, query) : 0;
  const isLowConfidence = topScore < SUMMARY_MIN_SCORE;
  const nextMatch = ranked.find((result) => result.retailer !== headlineMatch?.retailer);
  const foundRetailers = statuses.filter((status) => status.status === 'ok');
  const missingRetailers = statuses.filter((status) => status.status !== 'ok').map((status) => status.retailer);

  if (isLowConfidence) {
    insights.push(`Low confidence: the top result scored ${topScore} — no strong match found for "${query}". Consider adding brand, size, or refining your search.`);
  } else if (headlineMatch) {
    insights.push(`Cheapest match for "${query}": ${headlineMatch.productName} at ${headlineMatch.retailer} for $${headlineMatch.price.toFixed(2)}${headlineMatch.unit ? ` (${headlineMatch.unit})` : ''}.`);
  }
  if (!isLowConfidence && bestMatch && headlineMatch && (bestMatch.retailer !== headlineMatch.retailer || bestMatch.productName !== headlineMatch.productName)) {
    insights.push(`Strongest overall match: ${bestMatch.productName} at ${bestMatch.retailer} for $${bestMatch.price.toFixed(2)}.`);
  }
  if (!isLowConfidence && headlineMatch && nextMatch && nextMatch.retailer !== headlineMatch.retailer) {
    insights.push(`Next option: ${nextMatch.retailer} at $${nextMatch.price.toFixed(2)} for ${nextMatch.productName}.`);
  }
  if (foundRetailers.length > 0) {
    insights.push(`Matched ${foundRetailers.length} of ${ALL_RETAILERS.length} retailers for "${query}" after retrying alternate product phrases.`);
  }
  if (missingRetailers.length > 0) {
    // Categorise missing retailers by likely reason rather than a flat vague list
    const hardBlocked: RetailerName[] = ['Kmart', 'Chemist Warehouse', 'Priceline'];
    const groceryOnly: RetailerName[] = ['Aldi', 'IGA', 'Costco', 'Harris Farm'];
    const generalRetail: RetailerName[] = ['Target', 'Officeworks', 'Big W'];

    const blocked = missingRetailers.filter((r) => hardBlocked.includes(r as RetailerName));
    const notStocked = missingRetailers.filter((r) =>
      groceryOnly.includes(r as RetailerName) &&
      !statuses.find((s) => s.retailer === r && s.status === 'error')
    );
    const timedOut = missingRetailers.filter((r) =>
      !hardBlocked.includes(r as RetailerName) &&
      statuses.find((s) => s.retailer === r && (s.status === 'error' || (s.message ?? '').toLowerCase().includes('timed')))
    );
    const generalRetailMissing = missingRetailers.filter((r) =>
      generalRetail.includes(r as RetailerName) &&
      !timedOut.includes(r as RetailerName)
    );

    if (notStocked.length > 0) {
      insights.push(`${notStocked.join(', ')} ${notStocked.length === 1 ? 'does' : 'do'} not appear to stock this item — or their live search returned no usable match for "${query}".`);
    }
    if (generalRetailMissing.length > 0) {
      insights.push(`${generalRetailMissing.join(', ')} ${generalRetailMissing.length === 1 ? 'is a' : 'are'} general retailer${generalRetailMissing.length === 1 ? '' : 's'} — they may carry this product but it wasn't found in this search.`);
    }
    if (timedOut.length > 0) {
      insights.push(`${timedOut.join(', ')} ${timedOut.length === 1 ? 'timed out' : 'timed out or errored'} during this search — try again or visit their site directly.`);
    }
    if (blocked.length > 0) {
      insights.push(`${blocked.join(', ')} ${blocked.length === 1 ? 'blocks' : 'block'} automated price lookup. Visit their sites directly for current prices.`);
    }
  }

  return insights;
}

const SUMMARY_MIN_SCORE = 20; // results below this are too weak to describe confidently

function buildSummary(query: string, ranked: ProductResult[], cheapest: ProductResult | null, statuses: RetailerSearchStatus[]): string {
  if (ranked.length === 0) {
    return `I could not find a reliable live match for "${query}" across the retailer searches. Try adding the size, brand, or pack format, and keep in mind some stores may limit automated search coverage.`;
  }

  // If the best match scores too low, hedge rather than hallucinate
  const topScore = scoreProduct(ranked[0], query);
  if (topScore < SUMMARY_MIN_SCORE) {
    const suggestions = ranked.slice(0, 3).map((r) => `"${r.productName}" at ${r.retailer} ($${r.price.toFixed(2)})`).join('; ');
    return `I couldn't find a confident match for "${query}". The closest results were: ${suggestions}. Try refining your search with the brand name, size (e.g. 1L, 500g), or pack format.`;
  }

  // Headline = cheapest valid match (not necessarily highest-scored match)
  const headlineMatch = cheapest ?? ranked[0];
  const retailerLeaders = statuses
    .filter((status) => status.status === 'ok')
    .map((status) => `${status.retailer} (${status.count})`);
  // Show prices sorted cheapest first
  const comparable = [...ranked].sort((a, b) => a.price - b.price).slice(0, 4).map((result) => `${result.retailer} $${result.price.toFixed(2)}`);
  const summaryLines = [
    `Best price for "${query}": ${headlineMatch.productName} at ${headlineMatch.retailer} for $${headlineMatch.price.toFixed(2)}${headlineMatch.unit ? ` (${headlineMatch.unit})` : ''}.`,
  ];

  if (cheapest && (cheapest.retailer !== headlineMatch.retailer || cheapest.productName !== headlineMatch.productName || cheapest.price !== headlineMatch.price)) {
    summaryLines.push(`Also available: ${cheapest.productName} at ${cheapest.retailer} for $${cheapest.price.toFixed(2)}${cheapest.unit ? ` (${cheapest.unit})` : ''}.`);
  }
  if (comparable.length > 1) {
    summaryLines.push(`Closest prices: ${comparable.join(', ')}.`);
  }
  if (retailerLeaders.length > 0) {
    summaryLines.push(`Retailers with usable matches: ${retailerLeaders.join(', ')}.`);
  }

  return summaryLines.join('\n');
}

function chooseCheapestValidMatch(ranked: ProductResult[], query: string): ProductResult | null {
  if (ranked.length === 0) return null;
  const bestScore = scoreProduct(ranked[0], query);
  // Only include results within 20 points of the top scorer as "comparable cheapest"
  const threshold = Math.max(bestScore - 20, SUMMARY_MIN_SCORE);
  const comparable = ranked.filter((result) => scoreProduct(result, query) >= threshold);
  return [...comparable].sort((a, b) => a.price - b.price)[0] ?? ranked[0];
}

function sanitizeStapleQueryResults(query: string, ranked: ProductResult[], statuses: RetailerSearchStatus[]) {
  // Always return results if we have them — never suppress
  if (ranked.length === 0) return { results: ranked, statuses, suppressed: false };

  const stapleQuery = isStapleGroceryQuery(query);
  if (!stapleQuery) return { results: ranked, statuses, suppressed: false };

  // Prefer grocery-first results, but fall back to any results rather than showing nothing
  const groceryFirstResults = ranked.filter((result) => GROCERY_FIRST_RETAILERS.has(result.retailer));
  if (groceryFirstResults.length > 0) {
    return { results: ranked, statuses, suppressed: false };
  }

  // Return all results including marketplace/mixed — better than nothing
  return { results: ranked, statuses, suppressed: false };
}

function hasDistinctiveBrandSignal(query: string): boolean {
  const tokens = tokenize(query);
  return tokens.some((token) => token.length >= 5 && !GENERIC_QUERY_TOKENS.has(token));
}

const GENERIC_QUERY_TOKENS = new Set([
  'milk', 'almond', 'bread', 'loaf', 'eggs', 'egg', 'free', 'range', 'cheese', 'greek', 'yoghurt', 'yogurt',
  'coffee', 'instant', 'olive', 'oil', 'dal', 'dhal', 'toor', 'tur', 'tuvar', 'arhar', 'pigeon', 'peas',
  'rice', 'lentils', 'flour', 'chicken', 'breast', 'full', 'cream', 'skim', 'natural', 'vanilla', 'unsweetened',
  'barista', 'extra', 'virgin', '1l', '2l', '500g', '750ml', '1kg', '250ml',
]);

function getDistinctiveTokens(query: string): string[] {
  return tokenize(query).filter((token) => token.length >= 4 && !GENERIC_QUERY_TOKENS.has(token));
}

function getRetryVariantsForRetailer(retailer: RetailerName, query: string, retryVariants: string[]): string[] {
  // Always include all variants — filtering by brand token was too aggressive
  // and caused zero retries for brand queries like "Milklab Almond Milk"
  return retryVariants;
}

function resolveBestMatch(ranked: ProductResult[], query: string): ProductResult[] {
  if (ranked.length <= 1) return ranked;

  const scored = ranked.map((result) => ({ result, score: scoreProduct(result, query) }));
  const top = scored[0];
  const bestSupermarket = scored.find(({ result }) => GROCERY_FIRST_RETAILERS.has(result.retailer));
  const topIsMarketplace = MARKETPLACE_RETAILERS.has(top.result.retailer);
  const queryHasSize = /\b\d+(?:\.\d+)?\s?(?:kg|g|l|ml)\b/i.test(query);

  if (!topIsMarketplace || !bestSupermarket) return ranked;

  const withinResolverMargin = bestSupermarket.score >= top.score - 12;
  const marketplaceMissingUnit = !top.result.unit;
  const supermarketHasUnit = !!bestSupermarket.result.unit;
  const supermarketIsCloseEnough = bestSupermarket.score >= top.score - 24;

  if (
    !withinResolverMargin
    && !(marketplaceMissingUnit && supermarketHasUnit && bestSupermarket.score >= top.score - 18)
    && !(queryHasSize && supermarketHasUnit && supermarketIsCloseEnough)
  ) {
    return ranked;
  }

  return [
    bestSupermarket.result,
    ...ranked.filter((result) => result !== bestSupermarket.result),
  ];
}

// Hard wall-clock guard: if the whole search takes longer than this, return what we have
const GLOBAL_SEARCH_TIMEOUT_MS = 14000;

export async function runSmartSearch(query: string): Promise<SearchResponse> {
  const searchStarted = Date.now();

  const initialResults = await Promise.all(
    ALL_RETAILERS.map((retailer) => timeboxedRetailerSearch(retailer, query, getInitialTimeoutForRetailer(retailer))),
  );

  // If we're already close to the global timeout, skip retries entirely
  const elapsed = Date.now() - searchStarted;
  const timeLeftForRetries = GLOBAL_SEARCH_TIMEOUT_MS - elapsed;

  const successfulResults = initialResults.flatMap((result) => rankRetailerResults(result.results, query).slice(0, 2));
  const hasBrandSignal = hasDistinctiveBrandSignal(query);
  // Build retry variants once — shared across all retailers
  const retryVariants = unique([
    ...generateQueryVariants(query),
    ...buildDerivedQueries(query, successfulResults),
    ...buildDerivedQueries(query, initialResults.flatMap((result) => result.results).filter((result) => tokenize(result.productName).some((token) => tokenize(query).includes(token))).slice(0, 8)),
  ])
    .filter((v) => normalizeText(v) !== normalizeText(query))
    .slice(0, MAX_RETRY_VARIANTS);

  // PHASE 2: Parallel retries — all variants for a retailer fire simultaneously
  const finalResults = await Promise.all(initialResults.map(async (initial) => {
    const hasGoodResults = rankRetailerResults(initial.results, query).length > 0;
    if (hasGoodResults) return initial;
    if (!RETRYABLE_RETAILERS.has(initial.retailer)) return initial;
    if (retryVariants.length === 0) return initial;
    // Skip retries if we're nearly out of time
    if (timeLeftForRetries < 2000) return initial;

    const retailerRetryVariants = hasBrandSignal
      ? getRetryVariantsForRetailer(initial.retailer, query, retryVariants)
      : retryVariants;

    // Cap per-retry timeout so we don't blow past the global guard
    const retryTimeout = Math.min(
      CORE_SUPERMARKET_RETAILERS.has(initial.retailer) ? CORE_SUPERMARKET_RETRY_TIMEOUT_MS : RETRY_RETAILER_TIMEOUT_MS,
      Math.max(timeLeftForRetries - 500, 1000),
    );

    // Fire ALL variants in parallel — no sequential waiting
    const retryAttempts = await Promise.all(
      retailerRetryVariants.map((variant) => timeboxedRetailerSearch(initial.retailer, variant, retryTimeout)),
    );

    const bestAttempt = pickBestAttempt([initial, ...retryAttempts], query);
    if (rankRetailerResults(bestAttempt.results, query).length > 0) return bestAttempt;

    const cacheFallback = getCachedRetailerFallback(initial.retailer, retailerRetryVariants, query);
    return cacheFallback ?? bestAttempt;
  }));

  const rankedResults = finalResults
    .flatMap((result) => rankRetailerResults(result.results, query).slice(0, 4))
    .sort((a, b) => {
      const scoreDiff = scoreProduct(b, query) - scoreProduct(a, query);
      if (scoreDiff !== 0) return scoreDiff;
      return a.price - b.price;
    });

  const dedupedRankedResults = resolveBestMatch(dedupeResults(rankedResults), query);
  const baseStatuses = finalResults.map((result) => toRetailerStatus(result, query));
  const sanitized = sanitizeStapleQueryResults(query, dedupedRankedResults, baseStatuses);
  const cheapest = chooseCheapestValidMatch(sanitized.results, query);
  const insights = buildInsights(query, sanitized.results, cheapest, sanitized.statuses);
  const summary = sanitized.suppressed
    ? `Live retailer searches only returned general-retail fallback matches for "${query}", so Super M AI held them back instead of showing a misleading supermarket answer.`
    : buildSummary(query, sanitized.results, cheapest, sanitized.statuses);

  return {
    query,
    results: sanitized.results,
    cheapest,
    summary,
    insights,
    searchedAt: new Date().toISOString(),
    retailerStatuses: sanitized.statuses,
  };
}
