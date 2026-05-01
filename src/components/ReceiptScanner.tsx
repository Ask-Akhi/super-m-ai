'use client';
/**
 * ReceiptScanner — drag-and-drop receipt upload with live polling,
 * gamification feedback, and parsed item preview.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface ReceiptItem {
  name: string;
  canonical?: string;
  price: number;
  qty?: number;
  unit?: string;
  on_sale?: boolean;
  confidence: number;
}

interface PollResult {
  id: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  retailer?: string;
  itemsValidated: number;
  savingsPoints: number;
  items: ReceiptItem[] | null;
  message: string;
  error?: string;
  userStats?: {
    receipts_scanned: number;
    total_points: number;
    items_contributed: number;
  };
}

const TIER_THRESHOLDS = [
  { name: 'Price Legend',   emoji: '👑', min: 2000 },
  { name: 'Deal Hunter',    emoji: '🏆', min: 750 },
  { name: 'Savvy Shopper',  emoji: '🥈', min: 250 },
  { name: 'Bargain Finder', emoji: '🥉', min: 50 },
  { name: 'Newcomer',       emoji: '🌱', min: 0 },
];

function getTier(points: number) {
  return TIER_THRESHOLDS.find((t) => points >= t.min) ?? TIER_THRESHOLDS[4];
}

// Stable anon token per browser session
function getOrCreateToken(): string {
  if (typeof window === 'undefined') return 'ssr';
  let t = sessionStorage.getItem('super-m-token');
  if (!t) { t = 'user-' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('super-m-token', t); }
  return t;
}

export default function ReceiptScanner() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [result, setResult] = useState<PollResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [retailerHint, setRetailerHint] = useState('');
  const [showItems, setShowItems] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for result
  useEffect(() => {
    if (!submissionId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/receipt/${submissionId}`);
        const data: PollResult = await res.json();
        setResult(data);
        if (data.status === 'done' || data.status === 'failed') {
          clearInterval(pollRef.current!);
        }
      } catch { /* network hiccup, keep polling */ }
    }, 2000);
    return () => clearInterval(pollRef.current!);
  }, [submissionId]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('Please upload an image file.'); return; }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setResult(null);
    setSubmissionId(null);
    setShowItems(false);

    const form = new FormData();
    form.append('image', file);
    form.append('userToken', getOrCreateToken());
    if (retailerHint) form.append('retailer', retailerHint);

    try {
      const res = await fetch('/api/receipt', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      setSubmissionId(data.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [retailerHint]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setPreview(null); setResult(null); setSubmissionId(null);
    setShowItems(false); setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const userPoints = result?.userStats?.total_points ?? 0;
  const tier = getTier(userPoints);
  const isProcessing = uploading || (!!submissionId && result?.status !== 'done' && result?.status !== 'failed');

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧾</span>
          <div>
            <h3 className="text-white font-bold text-base">Scan Your Receipt</h3>
            <p className="text-slate-400 text-xs">Help others save — earn points for every item you contribute</p>
          </div>
        </div>
        {result?.userStats && (
          <div className="text-right">
            <div className="text-xs text-slate-400">Your score</div>
            <div className="text-indigo-300 font-bold flex items-center gap-1 justify-end">
              <span>{tier.emoji}</span>
              <span>{userPoints.toLocaleString()} pts</span>
            </div>
            <div className="text-xs text-slate-500">{tier.name}</div>
          </div>
        )}
      </div>

      {/* Retailer hint */}
      {!submissionId && !result && (
        <div className="mb-3">
          <select
            value={retailerHint}
            onChange={(e) => setRetailerHint(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all"
          >
            <option value="">Which store? (optional but helps accuracy)</option>
            {['Coles','Woolworths','Aldi','IGA','Costco','Harris Farm','Amazon AU'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {/* Drop zone */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
            ${dragOver
              ? 'border-indigo-400 bg-indigo-500/10'
              : 'border-white/15 hover:border-indigo-500/50 hover:bg-white/3'}
          `}
        >
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
          <div className="text-4xl mb-3">📷</div>
          <p className="text-white font-medium text-sm">Drop your receipt photo here</p>
          <p className="text-slate-500 text-xs mt-1">or click to browse · JPEG, PNG, WebP · max 10MB</p>

          {/* Points incentive */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-600/15 border border-indigo-500/30 text-indigo-300 text-xs">
            <span>✨</span>
            <span>Earn 10 pts per item + 50 bonus for big shops</span>
          </div>
        </div>
      )}

      {/* Preview + status */}
      {preview && (
        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            {/* Thumbnail */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Receipt preview" className="w-20 h-28 object-cover rounded-xl border border-white/10 flex-shrink-0" />

            {/* Status */}
            <div className="flex-1 min-w-0">
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-indigo-300 text-sm font-medium">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    AI is reading your receipt…
                  </div>
                  <div className="text-xs text-slate-500">Using Gemini Vision to extract prices</div>
                  {/* Animated progress bar */}
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full animate-pulse w-2/3" />
                  </div>
                </div>
              )}

              {result?.status === 'done' && (
                <div className="space-y-2">
                  <p className="text-emerald-400 font-semibold text-sm">{result.message}</p>
                  {result.retailer && (
                    <p className="text-slate-400 text-xs">🏪 Detected: <span className="text-white">{result.retailer}</span></p>
                  )}
                  {/* Points flash */}
                  {result.savingsPoints > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-xs font-bold">
                      ⭐ +{result.savingsPoints} points earned!
                    </div>
                  )}
                </div>
              )}

              {result?.status === 'failed' && (
                <div className="space-y-1">
                  <p className="text-red-400 font-semibold text-sm">❌ Couldn&apos;t process receipt</p>
                  <p className="text-slate-500 text-xs">{result.error ?? 'Try a clearer, well-lit photo.'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Parsed items accordion */}
          {result?.status === 'done' && result.items && result.items.length > 0 && (
            <div>
              <button
                onClick={() => setShowItems(!showItems)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 text-sm text-slate-300 transition-all border border-white/10"
              >
                <span>📋 View {result.items.length} extracted items</span>
                <span className={`transition-transform ${showItems ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {showItems && (
                <div className="mt-2 rounded-xl border border-white/10 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-white/5 text-slate-400">
                        <th className="text-left px-3 py-2">Product</th>
                        <th className="text-right px-3 py-2">Price</th>
                        <th className="text-right px-3 py-2 hidden sm:table-cell">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((item, i) => (
                        <tr key={i} className="border-t border-white/5 hover:bg-white/3">
                          <td className="px-3 py-2 text-slate-200">
                            <div>{item.canonical ?? item.name}</div>
                            {item.on_sale && (
                              <span className="text-orange-400 text-xs">🏷 On sale</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-400 font-mono font-semibold">
                            ${item.price.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right hidden sm:table-cell">
                            <span className={`
                              ${item.confidence >= 0.9 ? 'text-emerald-400' :
                                item.confidence >= 0.75 ? 'text-yellow-400' : 'text-slate-500'}
                            `}>
                              {Math.round(item.confidence * 100)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tier progress */}
          {result?.userStats && (
            <TierProgressBar points={userPoints} />
          )}

          {/* Reset */}
          <button
            onClick={reset}
            className="w-full py-2 rounded-xl text-sm text-slate-400 hover:text-white bg-white/3 hover:bg-white/8 border border-white/10 transition-all"
          >
            Scan another receipt →
          </button>
        </div>
      )}
    </div>
  );
}

function TierProgressBar({ points }: { points: number }) {
  const currentTierIdx = TIER_THRESHOLDS.findIndex((t) => points >= t.min);
  const current = TIER_THRESHOLDS[currentTierIdx];
  const next = currentTierIdx > 0 ? TIER_THRESHOLDS[currentTierIdx - 1] : null;
  const progress = next
    ? Math.min(100, ((points - current.min) / (next.min - current.min)) * 100)
    : 100;

  return (
    <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium flex items-center gap-1">
          {current.emoji} {current.name}
        </span>
        {next && (
          <span className="text-slate-500">
            {(next.min - points).toLocaleString()} pts to {next.emoji} {next.name}
          </span>
        )}
        {!next && <span className="text-yellow-400 text-xs">🏆 Max tier!</span>}
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
