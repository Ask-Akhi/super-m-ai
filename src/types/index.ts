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
}

export interface RetailerSearchStatus {
  retailer: RetailerName;
  status: 'ok' | 'empty' | 'blocked' | 'error';
  count: number;
  message?: string;
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
  insights: string[];
  error: string | null;
  selectedRetailers: RetailerName[];
  trendData: PriceTrendPoint[];
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
  setTrendData: (d: PriceTrendPoint[]) => void;
  setClarification: (opts: string[] | null) => void;
  reset: () => void;
}
