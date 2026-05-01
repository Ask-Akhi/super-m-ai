'use client';
import { useSearchStore } from '@/lib/store';
import { RETAILERS } from '@/lib/retailers';
import { RetailerName } from '@/types';

const STATUS_META = {
  ok:      { icon: '✅', label: 'Found',             color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  empty:   { icon: '🔍', label: 'No live match',     color: 'text-slate-400',   bg: 'bg-white/5 border-white/10' },
  blocked: { icon: '🔒', label: 'Restricted',        color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
  error:   { icon: '⚠️', label: 'Lookup limited',    color: 'text-amber-300',   bg: 'bg-amber-500/10 border-amber-500/20' },
};

function getStatusLabel(status: 'ok' | 'empty' | 'blocked' | 'error', message?: string): string {
  if (status === 'ok') return 'Found';
  if (status === 'blocked') return 'Restricted';
  const normalizedMessage = (message ?? '').toLowerCase();
  if (normalizedMessage.includes('timed out')) return 'Timed out';
  if (normalizedMessage.includes('google shopping')) return 'Indexed fallback';
  if (normalizedMessage.includes('requires js')) return 'Retailer limited';
  if (status === 'error') return 'Lookup limited';
  return 'No live match';
}

export default function RetailerCoverage() {
  const { retailerStatuses, results, query } = useSearchStore();
  if (retailerStatuses.length === 0 && results.length === 0) return null;

  // Build per-retailer counts from results if statuses not available
  const allRetailers = RETAILERS.map((r) => r.name) as RetailerName[];
  const countMap = new Map<RetailerName, number>();
  results.forEach((r) => countMap.set(r.retailer, (countMap.get(r.retailer) ?? 0) + 1));

  const rows = allRetailers.map((name) => {
    const fromStatus = retailerStatuses.find((s) => s.retailer === name);
    const count = fromStatus?.count ?? countMap.get(name) ?? 0;
    const status = fromStatus?.status ?? (count > 0 ? 'ok' : 'empty');
    const retailer = RETAILERS.find((r) => r.name === name)!;
    return { name, count, status, retailer, message: fromStatus?.message };
  });

  const found = rows.filter((r) => r.status === 'ok').length;

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>🏪</span> Store Coverage
        </h3>
        <span className="text-xs text-slate-400">
          {found}/{allRetailers.length} retailers found results
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
        {rows.map(({ name, count, status, retailer, message }) => {
          const meta = STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.empty;
          const statusLabel = status === 'ok' ? `${count} result${count !== 1 ? 's' : ''}` : getStatusLabel(status, message);
          return (
            <div
              key={name}
              className={`rounded-xl border px-3 py-2 flex flex-col items-center gap-1 text-center ${meta.bg}`}
            >
              <span className="text-lg">{retailer.logo}</span>
              <span className="text-xs font-semibold text-white leading-tight">{name}</span>
              <span className={`text-xs ${meta.color} font-medium`}>
                {statusLabel}
              </span>
              {status !== 'ok' && query ? (
                <a
                  href={retailer.searchUrl(query)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 text-[11px] text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                >
                  Search directly
                </a>
              ) : null}
            </div>
          );
        })}
      </div>

      {rows.some((r) => r.status !== 'ok') && (
        <p className="mt-3 text-xs text-slate-500">
          💡 Some stores may block automated searches or return incomplete live data. Use "Search directly" when a retailer does not return a usable live match here.
        </p>
      )}
    </div>
  );
}
