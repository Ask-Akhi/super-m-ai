'use client';
import { useSearchStore } from '@/lib/store';

export default function AISummary() {
  const { summary, query, insights } = useSearchStore();
  if (!summary) return null;

  return (
    <div className="glass-card section-frame rounded-[2rem] p-6 w-full border border-cyan-400/20 shadow-[0_18px_55px_rgba(15,23,42,0.25)]">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-2xl bg-[linear-gradient(135deg,rgba(52,211,153,0.2),rgba(79,70,229,0.32))]
          border border-cyan-400/30
          flex items-center justify-center text-base">
          🤖
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-cyan-300 text-sm font-semibold">Super M AI</span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-slate-500 text-xs">Results for "{query}"</span>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-300">
              Smart summary
            </span>
          </div>
          <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-4">
            <p className="text-slate-100 text-sm leading-7 whitespace-pre-line">{summary}</p>
          </div>
          {insights.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {insights.map((insight) => (
                <div key={insight} className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm leading-6 text-slate-300">
                  {insight}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
