'use client';
import { ProductResult } from '@/types';
import { RETAILER_MAP } from '@/lib/retailers';

interface Props {
  results: ProductResult[];
  cheapest: ProductResult | null;
}

export default function ResultsGrid({ results, cheapest }: Props) {
  if (results.length === 0) return null;

  const getImageSrc = (imageUrl?: string) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('/api/image?url=')) return imageUrl;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return `/api/image?url=${encodeURIComponent(imageUrl)}`;
    }
    return imageUrl;
  };

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-semibold text-white">
          {results.length} result{results.length !== 1 ? 's' : ''} found
        </h2>
        <span className="text-slate-400 text-sm">Sorted by strongest match first, then price</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((r, i) => {
          const retailer = RETAILER_MAP[r.retailer];
          const isCheapest = cheapest && r.retailer === cheapest.retailer && r.price === cheapest.price && r.productName === cheapest.productName;

          return (
            <a
              key={i}
              href={r.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`glass-card rounded-[1.8rem] p-4 flex flex-col gap-4 border border-white/10 hover:border-cyan-400/40
                transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(8,15,35,0.35)]
                group overflow-hidden relative
                ${isCheapest ? 'border-emerald-400/60 cheapest-pulse' : ''}`}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.18),transparent_72%)]" />
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{retailer?.logo ?? '🏪'}</span>
                  <div>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: retailer?.color ?? '#6366f1' }}
                    >
                      {r.retailer}
                    </span>
                    {isCheapest && (
                      <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full
                        bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        🏆 Cheapest!
                      </span>
                    )}
                  </div>
                </div>
                {r.onSale && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full
                    bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                    🔥 Sale
                  </span>
                )}
              </div>

              {/* Product image */}
              {r.imageUrl && (
                <div className="w-full h-40 rounded-[1.4rem] overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] flex items-center justify-center border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageSrc(r.imageUrl)}
                    alt={r.productName}
                    className="max-h-full max-w-full object-contain p-3 transition-transform duration-200 group-hover:scale-[1.03]"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Product name */}
              <p className="text-sm text-slate-200 font-medium line-clamp-2 leading-snug group-hover:text-white transition-colors">
                {r.productName}
              </p>

              {/* Pricing */}
              <div className="mt-auto flex items-end justify-between">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-bold ${isCheapest ? 'text-emerald-400' : 'text-white'}`}>
                      ${r.price.toFixed(2)}
                    </span>
                    {r.originalPrice && r.originalPrice > r.price && (
                      <span className="text-sm text-slate-500 line-through">
                        ${r.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {r.unit && <p className="text-xs text-slate-400">{r.unit}</p>}
                  {r.pricePerUnit && (
                    <p className="text-xs text-indigo-400">${r.pricePerUnit.toFixed(2)}/unit</p>
                  )}
                </div>
                {r.originalPrice && r.originalPrice > r.price && (
                  <span className="text-sm font-bold text-red-400">
                    -{Math.round(((r.originalPrice - r.price) / r.originalPrice) * 100)}%
                  </span>
                )}
              </div>              {/* Stock + Location */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className={`flex items-center gap-1 text-xs ${r.inStock ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${r.inStock ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {r.inStock ? 'In Stock' : 'Out of Stock'}
                </div>
                {(r.storeLocation || r.storeBranch) && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <span>📍</span>
                    {r.storeBranch ?? r.storeLocation}
                  </span>
                )}
              </div>

              {/* Store URL */}
              <div className="flex items-center gap-1 text-xs text-cyan-300 group-hover:text-cyan-200 transition-colors mt-auto">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View at {r.retailer} →
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
