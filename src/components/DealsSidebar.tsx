'use client';
import { ProductResult } from '@/types';
import { RETAILER_MAP } from '@/lib/retailers';

interface Props {
  results: ProductResult[];
}

function scoreDeal(result: ProductResult): number {
  const discountPct = result.originalPrice && result.originalPrice > result.price
    ? ((result.originalPrice - result.price) / result.originalPrice) * 100
    : 0;
  const cheapnessBonus = Math.max(0, 12 - result.price);
  const saleBonus = result.onSale ? 12 : 0;
  return discountPct + cheapnessBonus + saleBonus;
}

function getDealBadge(result: ProductResult): string {
  if (result.originalPrice && result.originalPrice >= result.price * 2) return 'Half price';
  if (result.originalPrice && result.originalPrice > result.price) {
    const pct = Math.round(((result.originalPrice - result.price) / result.originalPrice) * 100);
    return `${pct}% off`;
  }
  if (result.price <= 5) return 'Under $5';
  return 'Cheap pick';
}

export default function DealsSidebar({ results }: Props) {
  const deals = [...results]
    .filter((result) => result.inStock)
    .sort((a, b) => scoreDeal(b) - scoreDeal(a))
    .slice(0, 5);

  if (deals.length === 0) return null;

  return (
    <aside className="glass-card section-frame rounded-[2rem] border border-white/10 p-5 lg:sticky lg:top-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="display-font text-lg font-bold text-white">Cheap Picks</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            The best low-price and marked-down items from the current search.
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Live deals
        </span>
      </div>

      <div className="space-y-3">
        {deals.map((deal) => {
          const retailer = RETAILER_MAP[deal.retailer];
          const badge = getDealBadge(deal);
          const savings = deal.originalPrice && deal.originalPrice > deal.price
            ? `$${(deal.originalPrice - deal.price).toFixed(2)} saved`
            : null;

          return (
            <a
              key={`${deal.retailer}-${deal.productName}-${deal.price}`}
              href={deal.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-[1.4rem] border border-white/8 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(255,255,255,0.01))] p-4 transition-all hover:-translate-y-0.5 hover:border-cyan-400/30"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                  style={{ backgroundColor: retailer?.color ?? '#475569' }}
                >
                  {retailer?.logo} {deal.retailer}
                </span>
                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                  {badge}
                </span>
              </div>

              <p className="line-clamp-2 text-sm font-medium leading-6 text-slate-100">
                {deal.productName}
              </p>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-emerald-300">
                      ${deal.price.toFixed(2)}
                    </span>
                    {deal.originalPrice && deal.originalPrice > deal.price && (
                      <span className="text-sm text-slate-500 line-through">
                        ${deal.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    {deal.unit ?? 'Current live price'}
                  </p>
                </div>
                {savings && (
                  <span className="text-right text-xs font-semibold text-emerald-300">
                    {savings}
                  </span>
                )}
              </div>
              <div className="mt-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </a>
          );
        })}
      </div>
    </aside>
  );
}
