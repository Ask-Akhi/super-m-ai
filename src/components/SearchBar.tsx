'use client';
import { useEffect, useState, useRef } from 'react';
import { useSearchStore } from '@/lib/store';
import { SearchResponse } from '@/types';
import { RETAILERS } from '@/lib/retailers';

export default function SearchBar() {
  const [inputValue, setInputValue] = useState('');
  const { isLoading, setLoading, setResults, setError, setTrendData, setQuery, reset, setClarification, clarificationOptions } =
    useSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);
  // Do NOT trim here — trimming kills trailing spaces while the user is still typing
  const resolvedInputValue = inputRef.current?.value ?? inputValue ?? '';

  useEffect(() => {
    setLoading(false);
  }, [setLoading]);

  useEffect(() => {
    const syncAutofilledValue = () => {
      const domValue = inputRef.current?.value?.trim() ?? '';
      if (domValue && domValue !== inputValue) {
        setInputValue(domValue);
      }
    };

    const frame = window.requestAnimationFrame(syncAutofilledValue);
    window.setTimeout(syncAutofilledValue, 250);
    return () => window.cancelAnimationFrame(frame);
  }, [inputValue]);

  const handleSearch = async (q?: string, skipClarification = false) => {
    const query = (q ?? resolvedInputValue).trim();
    if (!query || isLoading) return;
    reset();
    setQuery(query);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, skipClarification }),
      });
      const data: SearchResponse & { trendData?: [] } = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Search failed');
      if (data.clarificationNeeded && data.clarificationOptions) {
        setClarification(data.clarificationOptions);
        setLoading(false);
        return;
      }
      setResults(data.results, data.cheapest, data.summary, data.retailerStatuses, data.insights);
      if (data.trendData) setTrendData(data.trendData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClarificationPick = (option: string) => {
    setInputValue(option);
    setClarification(null);
    handleSearch(option, true);
  };

  const handleSkipClarification = () => {
    setClarification(null);
    handleSearch(inputValue, true);
  };

  const suggestions = [
    '2L full cream milk', 'Free range eggs 12 pack', 'Sourdough bread loaf',
    'Chicken breast 1kg', 'Cheddar cheese 500g', 'Greek yoghurt 1kg',
    'Instant coffee 200g', 'Olive oil 750ml',
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Search bar */}
      <div className="search-spotlight rounded-[1.8rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-2 shadow-[0_24px_80px_rgba(7,17,31,0.35)]">
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-cyan-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            autoComplete="off"
            placeholder="Search a real grocery item, size or brand..."
            className="search-input w-full rounded-[1.6rem] border border-white/10 bg-[#0d1830]/90 py-4 pl-12 pr-4 text-base text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 transition-all"
            disabled={isLoading}
          />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-[1.6rem] bg-[linear-gradient(135deg,#34d399_0%,#4f46e5_55%,#7c3aed_100%)] px-8 py-4 text-white font-semibold shadow-[0_14px_40px_rgba(79,70,229,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(52,211,153,0.28)] disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning live store results...
              </>
            ) : (
              <><span>Compare Prices</span><span>→</span></>
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Smarter matching across all {RETAILERS.length} retailers</span>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">Retries alternate product phrases automatically</span>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-200">Installable on mobile as a web app</span>
      </div>

      {/* Clarification panel */}
      {clarificationOptions && !isLoading && (
        <div className="mt-4 glass-card rounded-3xl p-5 border border-cyan-400/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🤔</span>
            <p className="text-white font-semibold text-sm">Did you mean something more specific?</p>
          </div>
          <p className="text-slate-400 text-xs mb-4">Picking a specific variant gives you better price matches across all {RETAILERS.length} stores.</p>
          <div className="flex flex-wrap gap-2">
            {clarificationOptions.map((opt) => (
              <button key={opt} onClick={() => handleClarificationPick(opt)}
                className="px-4 py-2 rounded-xl text-sm bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 hover:border-cyan-300 text-cyan-100 hover:text-white transition-all font-medium">
                {opt}
              </button>
            ))}
            <button onClick={handleSkipClarification}
              className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all">
              Search &quot;{inputValue}&quot; anyway →
            </button>
          </div>
        </div>
      )}

      {/* Quick suggestions */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        <span className="text-slate-500 text-sm py-1">Try:</span>
        {suggestions.map((s) => (
          <button key={s} onClick={() => { setInputValue(s); handleSearch(s); }} disabled={isLoading}
            className="px-3 py-1 rounded-full text-sm bg-white/5 hover:bg-indigo-600/30 border border-white/10 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
