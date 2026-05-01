'use client';
import { ProductResult } from '@/types';
import { RETAILER_MAP } from '@/lib/retailers';

interface Props {
  cheapest: ProductResult;
  totalResults: number;
  priceRange: { min: number; max: number };
}

export default function CheapestBanner({ cheapest, totalResults, priceRange }: Props) {
  const retailer = RETAILER_MAP[cheapest.retailer];
  const savings = priceRange.max > priceRange.min
    ? (priceRange.max - priceRange.min).toFixed(2)
    : null;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-emerald-500/30 cheapest-pulse">
      <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/30 px-6 py-5
        flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl">🏆</div>
          <div>
            <p className="text-emerald-400 text-sm font-semibold uppercase tracking-wider">
              Best Price Found
            </p>
            <p className="text-white text-xl font-bold mt-0.5">{cheapest.productName}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: retailer?.color ?? '#6366f1' }}
              >
                {retailer?.logo} {cheapest.retailer}
              </span>
              <span className="text-slate-400 text-sm">
                across {totalResults} result{totalResults !== 1 ? 's' : ''} from{' '}
                {Object.keys(RETAILER_MAP).length} stores
              </span>
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-4xl font-extrabold text-emerald-400">
            ${cheapest.price.toFixed(2)}
          </div>
          {cheapest.unit && (
            <p className="text-slate-400 text-sm">{cheapest.unit}</p>
          )}
          {savings && parseFloat(savings) > 0 && (
            <p className="text-emerald-300 text-sm font-medium mt-1">
              Save up to ${savings} vs most expensive
            </p>
          )}
          <a
            href={cheapest.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400
              text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Shop Now →
          </a>
        </div>
      </div>
    </div>
  );
}
