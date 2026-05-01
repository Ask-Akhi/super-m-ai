'use client';
import { useSearchStore } from '@/lib/store';
import SearchBar from '@/components/SearchBar';
import RetailerFilter from '@/components/RetailerFilter';
import ResultsGrid from '@/components/ResultsGrid';
import CheapestBanner from '@/components/CheapestBanner';
import PriceTrendChart from '@/components/PriceTrendChart';
import AISummary from '@/components/AISummary';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import RetailerCoverage from '@/components/RetailerCoverage';
import DealsSidebar from '@/components/DealsSidebar';
import ReceiptScanner from '@/components/ReceiptScanner';
import { RETAILERS } from '@/lib/retailers';

export default function Home() {
  const { results, cheapest, isLoading, error, selectedRetailers, trendData, retailerStatuses } = useSearchStore();

  const filteredResults = results.filter((r) => selectedRetailers.includes(r.retailer));
  const filteredCheapest = (cheapest && selectedRetailers.includes(cheapest.retailer))
    ? cheapest
    : ([...filteredResults].sort((a, b) => a.price - b.price)[0] ?? null);
  const priceRange = filteredResults.length > 0
    ? {
        min: Math.min(...filteredResults.map((r) => r.price)),
        max: Math.max(...filteredResults.map((r) => r.price)),
      }
    : null;
  const hasSearchState = isLoading || results.length > 0 || error || retailerStatuses.length > 0;

  return (
    <main className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-8rem] top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      {/* ─── Hero Header ─────────────────────────────────────── */}
      <header className="w-full border-b border-white/5 px-4 py-4 relative z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[linear-gradient(135deg,#34d399_0%,#4f46e5_60%,#7c3aed_100%)] flex items-center justify-center text-lg shadow-[0_12px_30px_rgba(79,70,229,0.32)]">
              🛒
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">Super M</span>
              <span className="text-cyan-300 font-bold text-lg tracking-tight"> AI</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-slate-400 text-sm">
              Comparing {RETAILERS.length} Australian retailers
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium">Live</span>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ────────────────────────────────────── */}
      <section className="w-full pt-16 pb-12 px-4 relative z-10">
        <div className="ambient-grid max-w-6xl mx-auto rounded-[2.4rem] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0))] px-4 py-10 text-center sm:px-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
            bg-cyan-500/10 border border-cyan-400/20 text-cyan-200 text-sm font-medium mb-6">
            <span>Signal-led grocery search</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[0.95] mb-5">
            Smarter grocery search,
            <br />
            <span className="text-transparent bg-clip-text bg-[linear-gradient(90deg,#7dd3fc_0%,#a78bfa_40%,#34d399_100%)]">
              sharper price wins
            </span>
          </h1>

          <p className="text-slate-300/90 text-lg mb-10 max-w-3xl mx-auto leading-8">
            Super M AI now retries alternate product phrases, ranks closer supermarket matches, and explains where the strongest deals actually are across Australia&apos;s major supermarket, general retail and marketplace sites.
          </p>

          <SearchBar />
        </div>
      </section>

      {/* ─── Results Section ─────────────────────────────────── */}
      {hasSearchState && (
        <section className="w-full px-4 pb-20 relative z-10">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* Error */}
            {error && !isLoading && (
              <div className="rounded-2xl bg-red-900/20 border border-red-500/30 p-5
                flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="text-red-400 font-semibold">Search failed</p>
                  <p className="text-slate-300 text-sm mt-1">{error}</p>
                  <p className="text-slate-500 text-xs mt-2">The live retailer search returned an unexpected error.</p>
                </div>
              </div>
            )}

            {/* Loading skeleton */}
            {isLoading && <LoadingSkeleton />}

            {/* Results */}
            {!isLoading && results.length > 0 && (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_340px] xl:grid-cols-[minmax(0,1.8fr)_360px]">
                <div className="space-y-6">
                  <RetailerFilter />
                  <AISummary />
                  {filteredCheapest && priceRange && (
                    <CheapestBanner
                      cheapest={filteredCheapest}
                      totalResults={filteredResults.length}
                      priceRange={priceRange}
                    />
                  )}
                  {trendData.length > 0 && <PriceTrendChart trendData={trendData} />}
                  <ResultsGrid results={filteredResults} cheapest={filteredCheapest} />
                  {retailerStatuses.length > 0 && <RetailerCoverage />}
                </div>
                <div className="space-y-6">
                  <DealsSidebar results={filteredResults} />
                  <ReceiptScanner />
                </div>
              </div>
            )}

            {/* No results */}
            {!isLoading && !error && results.length > 0 && filteredResults.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-4xl mb-4">🔍</p>
                <p className="text-lg font-medium text-white">No results for selected retailers</p>
                <p className="text-sm mt-2">Try enabling more retailers using the filter above.</p>
              </div>
            )}

            {!isLoading && !error && results.length === 0 && retailerStatuses.length > 0 && (
              <div className="glass-card rounded-[2rem] border border-white/10 p-8 text-center">
                <p className="text-4xl mb-4">🧭</p>
                <p className="text-xl font-semibold text-white">No reliable product matches found yet</p>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                  The app searched the live supermarket pages, but the current product wording did not produce a strong enough match. Try adding the size, brand, flavour, or pack count to improve retailer coverage.
                </p>
                {retailerStatuses.length > 0 && <RetailerCoverage />}
              </div>
            )}
          </div>
        </section>
      )}

      {hasSearchState && (
        <section className="w-full px-4 pb-12 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.03] px-5 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Available Retailers
              </p>
              <div className="flex flex-wrap gap-2 text-sm text-slate-400">
                {RETAILERS.map((r) => (
                  <span
                    key={r.name}
                    className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.02] px-3 py-1.5"
                  >
                    <span>{r.logo}</span>
                    <span>{r.name}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ─── Empty State ─────────────────────────────────────── */}
      {!isLoading && results.length === 0 && !error && retailerStatuses.length === 0 && (
        <section className="flex-1 flex items-center justify-center px-4 pb-20 relative z-10">
          <div className="text-center max-w-lg">
            <div className="text-6xl mb-6">🛍️</div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Ready to search smarter?
            </h2>
            <p className="text-slate-400">
              Search any grocery, pantry or household item and Super M AI will compare live prices, retry weak matches, and surface the best supermarket result instead of giving you a basic one-line answer.
            </p>

            {/* Stats */}
            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { value: String(RETAILERS.length), label: 'Retailers' },
                { value: 'AI', label: 'Powered' },
                { value: '100%', label: 'Free' },
              ].map((s) => (
                <div key={s.label} className="glass-card rounded-2xl p-4">
                  <div className="text-2xl font-extrabold text-cyan-300">{s.value}</div>
                  <div className="text-slate-400 text-sm mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Receipt scanner teaser */}
            <div className="mt-10 max-w-md mx-auto">
              <ReceiptScanner />
            </div>
          </div>
        </section>
      )}

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="w-full border-t border-white/5 py-6 px-4 text-center text-slate-500 text-sm relative z-10">
        <p>
          Super M AI © {new Date().getFullYear()} · Prices are fetched live and may vary ·{' '}
          <span className="text-slate-600">For personal use only</span>
        </p>
      </footer>
    </main>
  );
}
