import { create } from 'zustand';
import { ProductResult, PriceTrendPoint, RetailerName, RetailerSearchStatus, SearchState } from '@/types';
import { RETAILERS } from '@/lib/retailers';

const ALL_RETAILERS = RETAILERS.map((r) => r.name) as RetailerName[];

export const useSearchStore = create<SearchState>((set) => ({  query: '',
  isLoading: false,
  results: [],
  cheapest: null,
  summary: '',
  insights: [],
  error: null,
  selectedRetailers: ALL_RETAILERS,
  trendData: [],
  trendSource: 'empty' as const,
  retailerStatuses: [],
  clarificationOptions: null,

  setQuery: (q) => set({ query: q }),
  setLoading: (v) => set({ isLoading: v }),
  setResults: (
    results: ProductResult[],
    cheapest: ProductResult | null,
    summary: string,
    statuses?: RetailerSearchStatus[],
    insights?: string[],
  ) =>
    set({ results, cheapest, summary, retailerStatuses: statuses ?? [], insights: insights ?? [] }),
  setError: (e) => set({ error: e }),
  toggleRetailer: (r: RetailerName) =>
    set((state) => ({
      selectedRetailers: state.selectedRetailers.includes(r)
        ? state.selectedRetailers.filter((x) => x !== r)
        : [...state.selectedRetailers, r],
    })),
  setTrendData: (d: PriceTrendPoint[], source: 'db' | 'simulated' | 'empty' = 'simulated') => set({ trendData: d, trendSource: source }),
  setClarification: (opts) => set({ clarificationOptions: opts }),  reset: () =>
    set({ results: [], cheapest: null, summary: '', insights: [], error: null, trendData: [], trendSource: 'empty', query: '', retailerStatuses: [], clarificationOptions: null, isLoading: false }),
}));
