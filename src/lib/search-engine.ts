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

const INITIAL_RETAILER_TIMEOUT_MS = 10000;
const CORE_SUPERMARKET_TIMEOUT_MS = 12000;
const RETRY_RETAILER_TIMEOUT_MS = 7000;
const CORE_SUPERMARKET_RETRY_TIMEOUT_MS = 8000;
const MAX_RETRY_VARIANTS = 6;
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
    results: rankedCachedResults,
    status: 'ok',
    message: 'Using cached retailer fallback because the live search returned no strong result.',
  };
}

function toRetailerStatus(result: ScraperResult, query: string): RetailerSearchStatus {
  const ranked = rankRetailerResults(result.results, query);
  return {
    retailer: result.retailer,
    status: ranked.length > 0 ? 'ok' : (result.status === 'ok' ? 'empty' : result.status),
    count: ranked.slice(0, 4).length,
    message: result.message,
  };
}

function buildInsights(query: string, ranked: ProductResult[], cheapest: ProductResult | null, statuses: RetailerSearchStatus[]): string[] {
  const insights: string[] = [];
  const bestMatch = ranked[0] ?? null;
  const nextMatch = ranked.find((result) => result.retailer !== bestMatch?.retailer);
  const foundRetailers = statuses.filter((status) => status.status === 'ok');
  const missingRetailers = statuses.filter((status) => status.status !== 'ok').map((status) => status.retailer);

  if (bestMatch) {
    insights.push(`${bestMatch.retailer} has the strongest match for "${query}" with ${bestMatch.productName}.`);
  }
  if (cheapest && bestMatch && (cheapest.retailer !== bestMatch.retailer || cheapest.productName !== bestMatch.productName || cheapest.price !== bestMatch.price)) {
    insights.push(`Cheapest valid offer is $${cheapest.price.toFixed(2)} at ${cheapest.retailer} for ${cheapest.productName}.`);
  }
  if (bestMatch && nextMatch) {
    insights.push(`Next closest match is ${nextMatch.retailer} at $${nextMatch.price.toFixed(2)} for ${nextMatch.productName}.`);
  }
  if (foundRetailers.length > 0) {
    insights.push(`Matched ${foundRetailers.length} of ${ALL_RETAILERS.length} retailers for "${query}" after retrying alternate product phrases.`);
  }
  if (missingRetailers.length > 0) {
    insights.push(`Live retailer lookup did not return a usable match from ${missingRetailers.join(', ')}. Those stores may be blocking automated search, timing out, or returning weak product data right now.`);
  }

  return insights;
}

function buildSummary(query: string, ranked: ProductResult[], cheapest: ProductResult | null, statuses: RetailerSearchStatus[]): string {
  if (ranked.length === 0) {
    return `I could not find a reliable live match for "${query}" across the retailer searches. Try adding the size, brand, or pack format, and keep in mind some stores may limit automated search coverage.`;
  }

  const bestMatch = ranked[0];
  const retailerLeaders = statuses
    .filter((status) => status.status === 'ok')
    .map((status) => `${status.retailer} (${status.count})`);
  const comparable = ranked.slice(0, 4).map((result) => `${result.retailer} $${result.price.toFixed(2)}`);
  const summaryLines = [
    `Best match for "${query}": ${bestMatch.productName} at ${bestMatch.retailer} for $${bestMatch.price.toFixed(2)}${bestMatch.unit ? ` (${bestMatch.unit})` : ''}.`,
  ];

  if (cheapest && (cheapest.retailer !== bestMatch.retailer || cheapest.productName !== bestMatch.productName || cheapest.price !== bestMatch.price)) {
    summaryLines.push(`Best current price among valid matches: ${cheapest.productName} at ${cheapest.retailer} for $${cheapest.price.toFixed(2)}${cheapest.unit ? ` (${cheapest.unit})` : ''}.`);
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
  // Use a low threshold — any result with a token match is valid
  const comparable = ranked.filter((result) => scoreProduct(result, query) > 0);
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

export async function runSmartSearch(query: string): Promise<SearchResponse> {
  const initialResults = await Promise.all(
    ALL_RETAILERS.map((retailer) => timeboxedRetailerSearch(retailer, query, getInitialTimeoutForRetailer(retailer))),
  );

  const successfulResults = initialResults.flatMap((result) => rankRetailerResults(result.results, query).slice(0, 2));
  const hasBrandSignal = hasDistinctiveBrandSignal(query);
  // Retry any retailer that failed, was blocked, or returned empty
  const retryVariants = unique([
    ...generateQueryVariants(query),
    ...buildDerivedQueries(query, successfulResults),
    ...buildDerivedQueries(query, initialResults.flatMap((result) => result.results).filter((result) => tokenize(result.productName).some((token) => tokenize(query).includes(token))).slice(0, 8)),
  ]).slice(0, MAX_RETRY_VARIANTS);

  const finalResults = await Promise.all(initialResults.map(async (initial) => {
    const hasGoodResults = rankRetailerResults(initial.results, query).length > 0;
    if (hasGoodResults) return initial;
    if (!RETRYABLE_RETAILERS.has(initial.retailer)) return initial;
    if (retryVariants.length <= 1) return initial;

    const retailerRetryVariants = hasBrandSignal
      ? getRetryVariantsForRetailer(initial.retailer, query, retryVariants)
      : retryVariants;

    const attempts: ScraperResult[] = [initial];
    for (const variant of retailerRetryVariants) {
      if (normalizeText(variant) === normalizeText(query)) continue;
      const retryTimeout = CORE_SUPERMARKET_RETAILERS.has(initial.retailer) ? CORE_SUPERMARKET_RETRY_TIMEOUT_MS : RETRY_RETAILER_TIMEOUT_MS;
      const retry = await timeboxedRetailerSearch(initial.retailer, variant, retryTimeout);
      attempts.push(retry);
      if (rankRetailerResults(retry.results, query).length > 0) break;
    }

    const bestAttempt = pickBestAttempt(attempts, query);
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
