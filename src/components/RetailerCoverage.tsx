'use client';
import { useSearchStore } from '@/lib/store';
import { RETAILERS } from '@/lib/retailers';
import { RetailerName } from '@/types';

const STATUS_META = {
  ok:      { icon: '✅', label: 'Found',    color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  empty:   { icon: '🔍', label: 'Not found', color: 'text-slate-400',   bg: 'bg-white/5 border-white/10' },
  blocked: { icon: '🚫', label: 'Blocked',   color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20' },
  error:   { icon: '⚠️', label: 'Error',     color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
};

export default function RetailerCoverage() {
  const { retailerStatuses, results } = useSearchStore();
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
    return { name, count, status, retailer };
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
        {rows.map(({ name, count, status, retailer }) => {
          const meta = STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.empty;
          return (
            <div
              key={name}
              className={`rounded-xl border px-3 py-2 flex flex-col items-center gap-1 text-center ${meta.bg}`}
            >
              <span className="text-lg">{retailer.logo}</span>
              <span className="text-xs font-semibold text-white leading-tight">{name}</span>
              <span className={`text-xs ${meta.color} font-medium`}>
                {status === 'ok' ? `${count} result${count !== 1 ? 's' : ''}` : meta.label}
              </span>
            </div>
          );
        })}
      </div>

      {rows.some((r) => r.status === 'blocked' || r.status === 'empty') && (
        <p className="mt-3 text-xs text-slate-500">
          💡 Some stores may block automated searches. Results shown are fetched live from retailer websites.
        </p>
      )}
    </div>
  );
}
