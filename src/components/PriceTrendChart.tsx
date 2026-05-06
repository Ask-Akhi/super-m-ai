'use client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { PriceTrendPoint } from '@/types';
import { RETAILER_MAP } from '@/lib/retailers';
import { getTrendDataForChart } from '@/lib/trends';

interface Props {
  trendData: PriceTrendPoint[];
  source?: 'db' | 'simulated' | 'empty';
}

export default function PriceTrendChart({ trendData, source }: Props) {
  if (trendData.length === 0) return null;

  const chartData = getTrendDataForChart(trendData);
  const retailers = [...new Set(trendData.map((d) => d.retailer))];
  const isReal = source === 'db';

  return (
    <div className="glass-card rounded-2xl p-6 w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-white font-semibold text-lg">📈 Price Trend</h3>
          <p className="text-slate-400 text-sm mt-0.5">Last 12 weeks across retailers</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full border ${isReal ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-slate-500 bg-white/5 border-white/10'}`}>
          {isReal ? '✅ Real data' : '〰 Estimated trend'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={(v: string) => {
              const d = new Date(v);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            tickLine={false}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#f1f5f9',
              fontSize: 13,
            }}
            formatter={(value) => [`$${typeof value === 'number' ? value.toFixed(2) : value}`, '']}            labelFormatter={(label) => {
              const d = new Date(String(label));
              return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
            }}
          />
          <Legend
            wrapperStyle={{ color: '#94a3b8', fontSize: 12, paddingTop: 16 }}
          />
          {retailers.map((retailer) => {
            const r = RETAILER_MAP[retailer];
            return (
              <Line
                key={retailer}
                type="monotone"
                dataKey={retailer}
                stroke={r?.color ?? '#6366f1'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
