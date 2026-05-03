import { ProductResult } from '@/types';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'pack', 'pk', 'x', 'long', 'life', 'uht', 'australia', 'own',
  'coles', 'woolworths', 'aldi', 'iga', 'costco', 'harris', 'farm', 'amazon', 'au', 'target', 'officeworks', 'big', 'kmart', 'chemist', 'warehouse', 'priceline', 'organic',
]);

const GENERIC_GROCERY_TOKENS = new Set([
  'milk', 'almond', 'bread', 'loaf', 'eggs', 'egg', 'free', 'range', 'cheese', 'greek', 'yoghurt', 'yogurt',
  'coffee', 'instant', 'olive', 'oil', 'dal', 'dhal', 'toor', 'tur', 'tuvar', 'arhar', 'pigeon', 'peas',
  'rice', 'lentils', 'flour', 'chicken', 'breast', 'full', 'cream', 'skim', 'natural', 'vanilla', 'unsweetened',
  'barista', 'extra', 'virgin',
]);

const SIZE_PATTERN = /\b\d+(?:\.\d+)?\s?(?:kg|g|l|ml|pack|pk|ct|count|x)\b/gi;

const GROCERY_SYNONYM_GROUPS = [
  ['toor dal', 'toor dhal', 'tur dal', 'tuvar dal', 'arhar dal', 'split pigeon peas', 'pigeon peas'],
  ['yoghurt', 'yogurt'],
  ['chilli', 'chili'],
  ['garbanzo', 'chickpea', 'chick peas'],
  ['coriander', 'cilantro'],
  ['free range', 'free-range'],
  ['cage free', 'cage-free'],
  ['tasty cheese', 'cheddar cheese'],
  ['ground coffee', 'coffee grounds'],
  ['basmati rice', 'basmati'],
];

const TOKEN_EQUIVALENTS: Record<string, string[]> = {
  toor: ['toor', 'tur', 'tuvar', 'arhar'],
  tur: ['toor', 'tur', 'tuvar', 'arhar'],
  tuvar: ['toor', 'tur', 'tuvar', 'arhar'],
  arhar: ['toor', 'tur', 'tuvar', 'arhar'],
  dal: ['dal', 'dhal'],
  dhal: ['dal', 'dhal'],
  yoghurt: ['yoghurt', 'yogurt'],
  yogurt: ['yoghurt', 'yogurt'],
  chilli: ['chilli', 'chili'],
  chili: ['chilli', 'chili'],
  chickpea: ['chickpea', 'chickpeas', 'garbanzo'],
  chickpeas: ['chickpea', 'chickpeas', 'garbanzo'],
  garbanzo: ['chickpea', 'chickpeas', 'garbanzo'],
  pigeon: ['pigeon', 'toor', 'tur', 'tuvar', 'arhar'],
};

const ACCESSORY_TOKENS = ['maker', 'machine', 'bottle', 'thermos', 'container', 'containers', 'lunchbox', 'jar', 'jars', 'drink', 'dispenser', 'spout'];
const NON_FOOD_TOKENS = ['mask', 'masks', 'sheet', 'serum', 'cream', 'moisturiser', 'moisturizer', 'anti', 'aging', 'vitamin', 'charger', 'cosmetic', 'beauty', 'wash', 'body', 'paint', 'shower', 'soap', 'cleanser', 'toner', 'skincare', 'artists', 'artist', 'watermixable'];
export const GROCERY_FIRST_RETAILERS = new Set(['Woolworths', 'Coles', 'Aldi', 'IGA', 'Harris Farm', 'Costco']);
export const MIXED_RETAILERS = new Set(['Big W', 'Target']);
export const GENERAL_RETAILERS = new Set(['Officeworks']);
export const MARKETPLACE_RETAILERS = new Set(['Amazon AU']);

const CATEGORY_PROFILES = [
  {
    id: 'eggs',
    anchors: ['egg', 'eggs'],
    positive: ['egg', 'eggs', 'free', 'range', 'cage', 'dozen', 'large', 'extra', 'fresh'],
    negative: ['incubator', 'incubators', 'candler', 'turning', 'tray', 'trays', 'poacher', 'poachers'],
    discouraging: ['chocolate', 'easter', 'toy'],
  },
  {
    id: 'cheese',
    anchors: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'tasty'],
    positive: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'tasty', 'block', 'shredded', 'slices', 'grated'],
    negative: ['board', 'knife', 'grater', 'slicer', 'snack', 'cracker', 'biscuit'],
    discouraging: ['dip', 'sauce'],
  },
  {
    id: 'rice',
    anchors: ['rice', 'basmati', 'jasmine', 'brown'],
    positive: ['rice', 'basmati', 'jasmine', 'brown', 'grain', 'long', 'white', 'microwave'],
    negative: ['paper', 'cakes', 'cracker', 'bran', 'noodle'],
    discouraging: ['pudding'],
  },
  {
    id: 'coffee',
    anchors: ['coffee', 'espresso', 'cappuccino', 'latte'],
    positive: ['coffee', 'espresso', 'instant', 'ground', 'beans', 'barista', 'cappuccino', 'latte'],
    negative: ['cup', 'cups', 'machine', 'maker', 'pods', 'capsules', 'mug', 'travel'],
    discouraging: ['biscuit', 'syrup'],
  },
  {
    id: 'yoghurt',
    anchors: ['yoghurt', 'yogurt', 'greek', 'skyr'],
    positive: ['yoghurt', 'yogurt', 'greek', 'strained', 'natural', 'vanilla', 'berry', 'style'],
    negative: ['tea', 'bottle', 'maker', 'machine', 'thermos', 'container', 'drink', 'mask', 'sheet', 'serum', 'cream', 'vitamin'],
    discouraging: ['bar', 'bars', 'oats'],
  },
  {
    id: 'milk',
    anchors: ['milk'],
    positive: ['milk', 'dairy', 'lactose', 'skim', 'full', 'cream', 'barista'],
    negative: ['tea', 'bottle', 'maker', 'thermos'],
    discouraging: ['chocolate', 'biscuit'],
  },
  {
    id: 'bread',
    anchors: ['bread', 'loaf'],
    positive: ['bread', 'loaf', 'wholemeal', 'white', 'sourdough', 'multigrain'],
    negative: ['knife', 'board', 'maker', 'machine'],
    discouraging: ['crumbs'],
  },
  {
    id: 'dal',
    anchors: ['dal', 'dhal', 'toor', 'tur', 'tuvar', 'arhar', 'pigeon'],
    positive: ['dal', 'dhal', 'toor', 'tur', 'tuvar', 'arhar', 'pigeon', 'peas', 'lentils', 'split'],
    negative: ['charger', 'bottle', 'maker', 'machine'],
    discouraging: ['snack'],
  },
  {
    id: 'oil',
    anchors: ['oil', 'olive'],
    positive: ['oil', 'olive', 'extra', 'virgin', 'evoo', 'classico', 'pressed'],
    negative: ['body', 'wash', 'paint', 'dispenser', 'maker', 'machine', 'soap', 'shower', 'serum'],
    discouraging: ['grapeseed', 'canola', 'sunflower'],
  },
];

type QueryIntent = {
  categoryId: string | null;
  anchorTokens: string[];
  positiveTokens: string[];
  negativeTokens: string[];
  discouragingTokens: string[];
  foodLike: boolean;
};

type MatchProfile = {
  queryTokens: string[];
  productTokens: string[];
  productText: string;
  matchedTokens: string[];
  unmatchedTokens: string[];
  distinctiveQueryTokens: string[];
  unmatchedDistinctiveTokens: string[];
  coverage: number;
  intent: QueryIntent;
};

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token));
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function extractSizeHints(value: string): string[] {
  return unique((normalizeText(value).match(SIZE_PATTERN) ?? []).map((hint) => hint.replace(/\s+/g, '')));
}

type ParsedSize = {
  value: number;
  unit: 'kg' | 'g' | 'l' | 'ml' | 'pack' | 'pk' | 'ct' | 'count' | 'x';
};

function parseSizeHint(sizeHint: string): ParsedSize | null {
  const match = sizeHint.match(/(\d+(?:\.\d+)?)(kg|g|l|ml|pack|pk|ct|count|x)/i);
  if (!match) return null;
  return {
    value: parseFloat(match[1]),
    unit: match[2].toLowerCase() as ParsedSize['unit'],
  };
}

function convertToBaseUnits(size: ParsedSize): { value: number; family: 'weight' | 'volume' | 'count' } {
  switch (size.unit) {
    case 'kg': return { value: size.value * 1000, family: 'weight' };
    case 'g': return { value: size.value, family: 'weight' };
    case 'l': return { value: size.value * 1000, family: 'volume' };
    case 'ml': return { value: size.value, family: 'volume' };
    default: return { value: size.value, family: 'count' };
  }
}

function sizesAreCompatible(queryHint: string, productHint: string, categoryId: string | null): boolean {
  if (queryHint === productHint) return true;
  const querySize = parseSizeHint(queryHint);
  const productSize = parseSizeHint(productHint);
  if (!querySize || !productSize) return false;

  const queryBase = convertToBaseUnits(querySize);
  const productBase = convertToBaseUnits(productSize);

  if (queryBase.family === productBase.family) {
    const delta = Math.abs(queryBase.value - productBase.value);
    const tolerance = Math.max(queryBase.value, productBase.value) * 0.12;
    return delta <= tolerance;
  }

  if (
    categoryId && ['yoghurt', 'milk'].includes(categoryId)
    && ((queryBase.family === 'volume' && productBase.family === 'weight') || (queryBase.family === 'weight' && productBase.family === 'volume'))
  ) {
    const delta = Math.abs(queryBase.value - productBase.value);
    const tolerance = Math.max(queryBase.value, productBase.value) * 0.12;
    return delta <= tolerance;
  }

  return false;
}

function singularize(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

function detectQueryIntent(query: string): QueryIntent {
  const queryTokens = tokenize(query);
  const profile = CATEGORY_PROFILES.find((candidate) => candidate.anchors.some((token) => queryTokens.includes(token)));

  if (!profile) {
    return {
      categoryId: null,
      anchorTokens: [],
      positiveTokens: [],
      negativeTokens: [],
      discouragingTokens: [],
      foodLike: true,
    };
  }

  return {
    categoryId: profile.id,
    anchorTokens: profile.anchors,
    positiveTokens: profile.positive,
    negativeTokens: profile.negative,
    discouragingTokens: profile.discouraging,
    foodLike: true,
  };
}

export function isStapleGroceryQuery(query: string): boolean {
  const intent = detectQueryIntent(query);
  return !!intent.categoryId || tokenize(query).length >= 3;
}

export function areTokensEquivalent(queryToken: string, productToken: string): boolean {
  const a = singularize(queryToken);
  const b = singularize(productToken);
  if (a === b) return true;

  const equivalents = TOKEN_EQUIVALENTS[a];
  if (equivalents?.includes(b)) return true;

  if (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;

  const distance = editDistance(a, b);
  return distance <= 1 && a[0] === b[0] && a[a.length - 1] === b[b.length - 1];
}

export function generateQueryVariants(query: string): string[] {
  const normalized = normalizeText(query);
  const tokens = tokenize(query);
  const coreTokens = tokens.filter((token) => !/^\d/.test(token));
  const sizeHints = extractSizeHints(query);
  const intent = detectQueryIntent(query);

  const variants = [
    query.trim(),
    normalized,
    coreTokens.join(' '),
    tokens.slice(0, 4).join(' '),
    coreTokens.slice(0, 3).join(' '),
    sizeHints.length ? `${coreTokens.slice(0, 3).join(' ')} ${sizeHints[0]}`.trim() : '',
  ];

  if (coreTokens.includes('milk') && coreTokens.includes('almond')) {
    variants.push('almond milk', 'unsweetened almond milk', 'almond milk 1L');
  }
  // milklab-specific — very common search on grocerywithai
  if (normalizeText(query).includes('milklab')) {
    variants.push('milklab almond milk', 'milklab oat milk', 'milklab barista', 'milklab milk');
    variants.push('almond milk 1L', 'barista almond milk');
  }
  // Brand + product fallbacks — if brand not found, search by product type
  const brandTokens = coreTokens.filter(t => t.length >= 5 && !['almond', 'cream', 'skimmed', 'oaten', 'fresh', 'light', 'whole', 'greek', 'plain', 'thick', 'extra', 'virgin', 'olive', 'split', 'pigeon', 'range', 'vanilla', 'natural', 'unsweetened', 'barista', 'organic'].includes(t));
  const productTokens2 = coreTokens.filter(t => ['milk', 'bread', 'eggs', 'cheese', 'yoghurt', 'yogurt', 'coffee', 'oil', 'dal', 'dhal', 'rice', 'flour', 'butter', 'cream', 'juice'].includes(t));
  if (brandTokens.length >= 1 && productTokens2.length >= 1) {
    // Search by product type alone as fallback
    variants.push(productTokens2.join(' '));
    const sizeStr = sizeHints[0] ? ` ${sizeHints[0]}` : '';
    variants.push(productTokens2.join(' ') + sizeStr);
  }
  if (coreTokens.includes('bread')) {
    variants.push(tokens.filter((token) => token !== 'loaf').join(' '));
  }
  if (intent.categoryId === 'eggs') {
    variants.push('free range eggs');
    variants.push('eggs');
    variants.push(normalized.replace(/\b12 pack\b/g, '12 eggs'));
    variants.push(normalized.replace(/\beggs 12 pack\b/g, '12 eggs'));
    variants.push(normalized.replace(/\bfree range eggs 12 pack\b/g, 'free range eggs'));
    variants.push(normalized.replace(/\bfree range eggs\b/g, '12 free range eggs'));
    variants.push(normalized.replace(/\bcage free\b/g, 'free range'));
  }
  if (intent.categoryId === 'cheese') {
    variants.push('cheddar cheese');
    variants.push('tasty cheese');
    variants.push(normalized.replace(/\btasty\b/g, 'cheddar'));
    variants.push(normalized.replace(/\bcheddar\b/g, 'tasty'));
  }
  if (intent.categoryId === 'rice') {
    variants.push('rice');
    variants.push(normalized.replace(/\bbasmati rice\b/g, 'basmati'));
    variants.push(normalized.replace(/\bjasmine rice\b/g, 'jasmine'));
  }
  if (intent.categoryId === 'coffee') {
    variants.push('instant coffee');
    variants.push('ground coffee');
    variants.push(normalized.replace(/\bcoffee grounds\b/g, 'ground coffee'));
  }
  if (intent.categoryId === 'oil') {
    variants.push('olive oil');
    variants.push('extra virgin olive oil');
    if (sizeHints[0]) {
      variants.push(`extra virgin olive oil ${sizeHints[0]}`);
      variants.push(`olive oil ${sizeHints[0]}`);
    }
    variants.push(normalized.replace(/\bolive oil\b/g, 'extra virgin olive oil'));
  }

  for (const group of GROCERY_SYNONYM_GROUPS) {
    for (const phrase of group) {
      if (!normalized.includes(phrase)) continue;
      for (const replacement of group) {
        variants.push(normalized.replace(phrase, replacement));
        if (sizeHints[0]) {
          variants.push(`${replacement} ${sizeHints[0]}`.trim());
        }
      }
    }
  }

  if (coreTokens.includes('yogurt')) {
    variants.push(normalized.replace(/\byogurt\b/g, 'yoghurt'));
  }
  if (coreTokens.includes('yoghurt')) {
    variants.push(normalized.replace(/\byoghurt\b/g, 'yogurt'));
  }
  if (intent.categoryId === 'yoghurt') {
    variants.push(normalized.replace(/\byogurt\b/g, 'yoghurt'));
    variants.push(normalized.replace(/\b1l\b/g, '1kg'));
    variants.push(normalized.replace(/\b1 l\b/g, '1kg'));
    variants.push(normalized.replace(/\b1l\b/g, '1 kg'));
    variants.push(normalized.replace(/\b1 l\b/g, '1 kg'));
    variants.push(coreTokens.filter((token) => token !== '1l').join(' '));
  }

  return unique(variants.filter((variant) => variant && variant.length >= 3));
}

export function getMatchProfile(result: ProductResult, query: string): MatchProfile {
  const queryTokens = tokenize(query);
  const productContext = `${result.productName} ${result.unit ?? ''}`;
  const productTokens = tokenize(productContext);
  const productText = normalizeText(productContext);
  const matchedTokens = queryTokens.filter((token) => (
    productTokens.some((productToken) => areTokensEquivalent(token, productToken)) || productText.includes(token)
  ));
  const coverage = queryTokens.length > 0 ? matchedTokens.length / queryTokens.length : 0;
  const unmatchedTokens = queryTokens.filter((token) => !matchedTokens.includes(token));
  const distinctiveQueryTokens = queryTokens.filter((token) => !GENERIC_GROCERY_TOKENS.has(token) && !extractSizeHints(token).length);
  const unmatchedDistinctiveTokens = distinctiveQueryTokens.filter((token) => !matchedTokens.includes(token));

  return {
    queryTokens,
    productTokens,
    productText,
    matchedTokens,
    unmatchedTokens,
    distinctiveQueryTokens,
    unmatchedDistinctiveTokens,
    coverage,
    intent: detectQueryIntent(query),
  };
}

export function scoreProduct(result: ProductResult, query: string): number {
  const {
    queryTokens,
    productTokens,
    productText,
    matchedTokens,
    unmatchedTokens,
    distinctiveQueryTokens,
    unmatchedDistinctiveTokens,
    coverage,
    intent,
  } = getMatchProfile(result, query);
  const queryText = normalizeText(query);
  const querySizes = extractSizeHints(query);
  const productSizes = extractSizeHints(`${result.productName} ${result.unit ?? ''}`);

  let score = 0;

  for (const token of queryTokens) {
    if (productTokens.some((productToken) => areTokensEquivalent(token, productToken))) score += 14;
    else if (productText.includes(token)) score += 8;
  }

  if (productText.includes(queryText)) score += 20;
  score += Math.round(coverage * 20);
  if (matchedTokens.length === queryTokens.length && queryTokens.length > 1) score += 18;
  if (distinctiveQueryTokens.length > 0 && unmatchedDistinctiveTokens.length === 0) score += 18;
  if (unmatchedDistinctiveTokens.length > 0) score -= unmatchedDistinctiveTokens.length * 22;

  if (intent.anchorTokens.length > 0) {
    const hasAnchor = intent.anchorTokens.some((token) => productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
    if (hasAnchor) score += 22;
    else score -= 40;
  }

  const positiveHits = intent.positiveTokens.filter((token) => productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
  score += positiveHits.length * 4;

  const negativeHits = intent.negativeTokens.filter((token) => productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
  score -= negativeHits.length * 18;

  const discouragingHits = intent.discouragingTokens.filter((token) => productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
  score -= discouragingHits.length * 8;

  if (intent.foodLike) {
    const accessoryHits = ACCESSORY_TOKENS.filter((token) => productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
    score -= accessoryHits.length * 12;
    const nonFoodHits = NON_FOOD_TOKENS.filter((token) => productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
    score -= nonFoodHits.length * 14;
  }

  if (intent.foodLike) {
    if (GROCERY_FIRST_RETAILERS.has(result.retailer)) score += 18;
    else if (MIXED_RETAILERS.has(result.retailer)) score += 4;
    else if (GENERAL_RETAILERS.has(result.retailer)) score -= 12;
    else if (MARKETPLACE_RETAILERS.has(result.retailer)) score -= 14;
  }

  if (intent.categoryId === 'yoghurt' || intent.categoryId === 'milk' || intent.categoryId === 'bread' || intent.categoryId === 'dal' || intent.categoryId === 'oil' || intent.categoryId === 'eggs' || intent.categoryId === 'cheese' || intent.categoryId === 'rice' || intent.categoryId === 'coffee') {
    if (GROCERY_FIRST_RETAILERS.has(result.retailer)) score += 12;
    if (GENERAL_RETAILERS.has(result.retailer)) score -= 10;
    if (MARKETPLACE_RETAILERS.has(result.retailer)) score -= 8;
  }
  if (intent.categoryId === 'milk' && GENERAL_RETAILERS.has(result.retailer)) {
    score -= 18;
  }

  if (querySizes.length > 0) {
    const matchingSizes = querySizes.filter((size) => productSizes.some((productSize) => sizesAreCompatible(size, productSize, intent.categoryId)));
    score += matchingSizes.length * 16;
    if (matchingSizes.length === 0 && productSizes.length === 0) score -= 10;
    if (matchingSizes.length === 0 && productSizes.length > 0) {
      const onlyUnmatchedSize = unmatchedTokens.every((token) => extractSizeHints(token).length > 0 || /^\d+(?:\.\d+)?(?:kg|g|l|ml|pack|pk|ct|count|x)?$/.test(token));
      score -= onlyUnmatchedSize ? 3 : 10;
    }
  }

  // Penalise multipack products when the query doesn't ask for a multi-pack.
  // This applies even if the query has a size hint (e.g. "almond milk 1l" should
  // NOT match "Almond Milk 1L 8 Pack" — user wants a single unit, not a bulk pack).
  if (!/\b\d+\s?(?:pack|pk)\b/i.test(query) && !/\bpack\b/i.test(query)) {
    const packCountMatch = result.productName.match(/\b(\d+)\s?(?:pack|pk)\b/i);
    const packCount = packCountMatch ? parseInt(packCountMatch[1], 10) : 0;
    if (packCount >= 4) score -= 50;       // 4-pack, 6-pack, 8-pack, 12-pack …
    else if (packCount >= 2) score -= 22;  // 2-pack, 3-pack
    else if (/pack of|x\s?\d+/i.test(result.productName)) score -= 12;
  }
  if (intent.categoryId === 'milk' && /\bmini\b/i.test(result.productName)) {
    score -= 22;
  }

  if (!result.inStock) score -= 20;
  if (result.onSale) score += 4;
  if (result.pricePerUnit && result.pricePerUnit <= result.price) score += 2;

  return score;
}

export function dedupeResults(results: ProductResult[]): ProductResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const key = `${result.retailer}|${normalizeText(result.productName)}|${result.price.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function rankRetailerResults(results: ProductResult[], query: string): ProductResult[] {
  return dedupeResults(results)
    .map((result) => {
      const profile = getMatchProfile(result, query);
      return { result, score: scoreProduct(result, query), profile };
    })
    .filter(({ score, profile }) => {
      if (profile.intent.foodLike) {
        const hasAccessory = ACCESSORY_TOKENS.some((token) => profile.productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
        if (hasAccessory) return false;
      }
      if (profile.intent.categoryId === 'yoghurt') {
        const hasNonFood = NON_FOOD_TOKENS.some((token) => profile.productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
        if (hasNonFood) return false;
      }
      if (profile.intent.categoryId === 'oil') {
        const hasNonFood = NON_FOOD_TOKENS.some((token) => profile.productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
        if (hasNonFood) return false;
        const queryNeedsOlive = profile.queryTokens.includes('olive');
        const productHasOlive = profile.productTokens.some((productToken) => areTokensEquivalent('olive', productToken));
        if (queryNeedsOlive && !productHasOlive) return false;
      }
      if (profile.intent.categoryId === 'eggs') {
        const hasEggAccessory = ['incubator', 'incubators', 'candler', 'turning', 'tray', 'trays', 'poacher', 'poachers']
          .some((token) => profile.productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
        if (hasEggAccessory) return false;
      }
      if (profile.intent.categoryId === 'cheese') {
        const hasCheeseAccessory = ['board', 'knife', 'grater', 'slicer']
          .some((token) => profile.productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
        if (hasCheeseAccessory) return false;
      }
      if (profile.intent.categoryId === 'rice') {
        const hasRiceJunk = ['paper', 'cakes', 'cracker', 'bran', 'noodle']
          .some((token) => profile.productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
        if (hasRiceJunk) return false;
      }
      if (profile.intent.categoryId === 'coffee') {
        const hasCoffeeAccessory = ['cup', 'cups', 'machine', 'maker', 'mug', 'travel']
          .some((token) => profile.productTokens.some((productToken) => areTokensEquivalent(token, productToken)));
        if (hasCoffeeAccessory) return false;
      }
      if (profile.unmatchedDistinctiveTokens.length > 0 && profile.queryTokens.length >= 3) {
        // Allow result if ANY distinctive token matches — don't require ALL of them.
        // e.g. "Milklab Almond Milk" → product "Almond Milk 1L" should pass because "almond" + "milk" match
        const hasAnyDistinctiveMatch = profile.distinctiveQueryTokens.some((token) =>
          profile.productTokens.some((pt) => areTokensEquivalent(token, pt)) || profile.productText.includes(token)
        );
        const hasEnoughCoverage = profile.matchedTokens.length >= Math.ceil(profile.queryTokens.length * 0.4);
        if (!hasAnyDistinctiveMatch && !hasEnoughCoverage) return false;
      }
      if (profile.intent.anchorTokens.length > 0 && profile.matchedTokens.length === 0) return false;
      if (profile.queryTokens.length <= 1) return score > 0;
      if (profile.queryTokens.length === 2) return profile.matchedTokens.length >= 1 && score > 5;
      // 3+ word queries: require at least 1 matched token and positive score
      return profile.matchedTokens.length >= 1 && score > 5;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.result.price - b.result.price;
    })
    .map(({ result }) => result);
}

export function buildDerivedQueries(query: string, results: ProductResult[]): string[] {
  const baseTokens = new Set(tokenize(query));
  const suggestions = results
    .slice(0, 6)
    .map((result) => {
      const tokens = tokenize(`${result.productName} ${result.unit ?? ''}`)
        .filter((token) => token.length > 2)
        .filter((token) => (
          baseTokens.has(token)
          || ['milk', 'bread', 'eggs', 'cheese', 'coffee', 'oil', 'yoghurt', 'yogurt', 'dal', 'dhal', 'pigeon', 'peas', 'rice', 'lentils', 'flour'].includes(token)
        ));
      return tokens.slice(0, 4).join(' ');
    })
    .filter(Boolean);

  return unique(suggestions);
}
