'use client';
import { useSearchStore } from '@/lib/store';
import { RETAILER_MAP } from '@/lib/retailers';

export default function RetailerFilter() {
  const { selectedRetailers, toggleRetailer } = useSearchStore();
  const retailers = Object.values(RETAILER_MAP);

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-slate-400 text-sm font-medium mr-1">Filter:</span>
      {retailers.map((r) => {
        const active = selectedRetailers.includes(r.name);
        return (
          <button
            key={r.name}
            onClick={() => toggleRetailer(r.name)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
              border transition-all duration-150 font-medium
              ${active
                ? 'text-white border-transparent'
                : 'text-slate-400 border-white/10 bg-transparent hover:border-white/30'}
            `}
            style={active ? { backgroundColor: r.color, borderColor: r.color } : {}}
          >
            <span>{r.logo}</span>
            <span>{r.name}</span>
          </button>
        );
      })}
    </div>
  );
}
