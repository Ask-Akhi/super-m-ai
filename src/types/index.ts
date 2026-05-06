export type RetailerName =
  | 'Coles'
  | 'Woolworths'
  | 'Aldi'
  | 'IGA'
  | 'Costco'
  | 'Harris Farm'
  | 'Amazon AU'
  | 'Target'
  | 'Officeworks'
  | 'Big W'
  | 'Kmart'
  | 'Chemist Warehouse'
  | 'Priceline';

export interface Retailer {
  name: RetailerName;
  baseUrl: string;
  searchUrl: (query: string) => string;
  color: string;
  logo: string;
}

export interface ProductResult {
  retailer: RetailerName;
  productName: string;
  price: number;
  originalPrice?: number;
  unit?: string;
  pricePerUnit?: number;
  imageUrl?: string;
  productUrl: string;
  inStock: boolean;
  onSale: boolean;
  scrapedAt: string;
  storeLocation?: string;  // e.g. "Online · Free delivery $65+"
  storeBranch?: string;    // e.g. "Nationwide", "Sydney Metro"
  sourceType?: 'live' | 'indexed_fallback' | 'cached_fallback' | 'general_retail_fallback';
}

export interface RetailerSearchStatus {
  retailer: RetailerName;
  status: 'ok' | 'empty' | 'blocked' | 'error';
  count: number;
  message?: string;
  detailCode?: 'live_match' | 'no_catalog_match' | 'timed_out' | 'proxy_blocked' | 'rate_limited' | 'retailer_blocked' | 'indexed_fallback' | 'cached_fallback' | 'upstream_error' | 'general_retail_suppressed';
}

export interface PriceTrendPoint {
  date: string;
  price: number;
  retailer: RetailerName;
}

export interface SearchResponse {
  query: string;
  results: ProductResult[];
  cheapest: ProductResult | null;
  summary: string;
  insights?: string[];
  searchedAt: string;
  retailerStatuses?: RetailerSearchStatus[];
  clarificationNeeded?: boolean;
  clarificationOptions?: string[];
  meta?: {
    durationMs?: number;
    buildVersion?: string;
  };
}

export interface TrendsResponse {
  productName: string;
  trends: PriceTrendPoint[];
}

export interface SearchState {
  query: string;
  isLoading: boolean;
  results: ProductResult[];
  cheapest: ProductResult | null;
  summary: string;
  insights: string[];  error: string | null;
  selectedRetailers: RetailerName[];
  trendData: PriceTrendPoint[];
  trendSource: 'db' | 'simulated' | 'empty';
  retailerStatuses: RetailerSearchStatus[];
  clarificationOptions: string[] | null;
  setQuery: (q: string) => void;
  setLoading: (v: boolean) => void;
  setResults: (
    r: ProductResult[],
    cheapest: ProductResult | null,
    summary: string,
    statuses?: RetailerSearchStatus[],
    insights?: string[],
  ) => void;
  setError: (e: string | null) => void;
  toggleRetailer: (r: RetailerName) => void;
  setTrendData: (d: PriceTrendPoint[], source?: 'db' | 'simulated' | 'empty') => void;
  setClarification: (opts: string[] | null) => void;
  reset: () => void;
}
