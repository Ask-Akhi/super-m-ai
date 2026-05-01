'use client';

export default function LoadingSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* AI summary skeleton */}
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="h-4 w-32 bg-white/10 rounded-full" />
        <div className="h-3 w-full bg-white/5 rounded-full" />
        <div className="h-3 w-4/5 bg-white/5 rounded-full" />
        <div className="h-3 w-3/5 bg-white/5 rounded-full" />
      </div>

      {/* Cheapest banner skeleton */}
      <div className="rounded-2xl bg-emerald-900/20 border border-emerald-500/20 p-5 flex justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3 w-24 bg-white/10 rounded-full" />
          <div className="h-5 w-64 bg-white/10 rounded-full" />
          <div className="h-3 w-48 bg-white/5 rounded-full" />
        </div>
        <div className="h-10 w-24 bg-emerald-500/20 rounded-xl" />
      </div>

      {/* Grid skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-white/10" />
              <div className="h-5 w-20 rounded-full bg-white/10" />
            </div>
            <div className="h-32 rounded-xl bg-white/5 shimmer" />
            <div className="h-3 w-full bg-white/10 rounded-full" />
            <div className="h-3 w-2/3 bg-white/5 rounded-full" />
            <div className="h-7 w-16 bg-white/10 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
