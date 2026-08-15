'use client';

import { useMemo, useState } from 'react';
import type { FlightHistory, RouteHistory, PriceRecord } from '@/lib/types';
import { formatKRW } from '@/lib/format';

const NZ_DESTS = new Set(['AKL']);

function extractBaseKey(routeId: string): string {
  const withoutDate = routeId.replace(/_\d{4}-\d{2}-\d{2}$/, '');
  const normalized = withoutDate
    .replace(/→/g, ' ')
    .replace(/->/g, ' ')
    .replace(/[-_]/g, ' ');
  const parts = normalized.split(/\s+/).map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s));
  if (parts.length >= 2) return `${parts[0]}_${parts[parts.length - 1]}`;
  return withoutDate.toUpperCase();
}

// "도시 · 출발→도착" 형식이면 도시명, 아니면 "ICN→HND" 약식
function buttonLabel(route: RouteHistory): string {
  const dotIdx = route.routeName.indexOf('·');
  if (dotIdx > 0) return route.routeName.slice(0, dotIdx).trim();
  const parts = route.routeId.split('_');
  return parts.length >= 2 ? `${parts[0]}→${parts[parts.length - 1]}` : route.routeId;
}

function mergeRoutes(history: FlightHistory): RouteHistory[] {
  const map = new Map<string, RouteHistory>();
  for (const route of Object.values(history)) {
    if (!route?.routeId || route.records.length === 0) continue;
    const key = extractBaseKey(route.routeId);
    if (!/^[A-Z]{3}_[A-Z]{3}$/.test(key)) continue;
    if (!map.has(key)) {
      const cleanName = route.routeName.replace(/\s*\(.*출발\)\s*$/, '');
      map.set(key, { routeId: key, routeName: cleanName, records: [] });
    }
    const existing = map.get(key)!;
    const byDate = new Map<string, PriceRecord>();
    for (const r of [...existing.records, ...route.records]) {
      if (!byDate.has(r.date) || r.price < byDate.get(r.date)!.price) {
        byDate.set(r.date, r);
      }
    }
    existing.records = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
  return Array.from(map.values())
    .filter(r => r.records.length > 0)
    .sort((a, b) => a.routeName.localeCompare(b.routeName));
}

function LineChart({ records }: { records: PriceRecord[] }) {
  const W = 320, H = 120, PAD = 20;
  const prices = records.map(r => r.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const pts = records.map((r, i) => {
    const x = PAD + (i / Math.max(records.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((r.price - min) / range) * (H - PAD * 2);
    return [x, y] as [number, number];
  });

  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const minIdx = prices.indexOf(min);
  const maxIdx = prices.indexOf(max);
  const lastIdx = records.length - 1;
  const [minX, minY] = pts[minIdx];
  const labelAbove = minY > 16;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
      <path d={path} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => {
        const isMin = i === minIdx;
        const isMax = i === maxIdx;
        const isLast = i === lastIdx;
        return (
          <circle
            key={i}
            cx={x} cy={y}
            r={isMin || isMax || isLast ? 3.5 : 1.5}
            fill={isMin ? '#4ade80' : isMax ? '#f87171' : isLast ? '#38bdf8' : '#38bdf8'}
            fillOpacity={isMin || isMax || isLast ? 1 : 0.5}
          />
        );
      })}
      <text x={minX} y={labelAbove ? minY - 8 : minY + 14} textAnchor="middle" fontSize="11" fill="#4ade80" fontWeight="bold">
        {formatKRW(min)}
      </text>
    </svg>
  );
}

export function PriceTrend({ history }: { history: FlightHistory }) {
  const routes = useMemo(() => mergeRoutes(history), [history]);
  const japanRoutes = routes.filter(r => !NZ_DESTS.has(r.routeId.split('_').pop() ?? ''));
  const nzRoutes = routes.filter(r => NZ_DESTS.has(r.routeId.split('_').pop() ?? ''));

  const [selectedId, setSelectedId] = useState(routes[0]?.routeId ?? '');

  if (routes.length === 0) return null;

  const selected = routes.find(r => r.routeId === selectedId) ?? routes[0];
  const records = [...selected.records].sort((a, b) => a.date.localeCompare(b.date));
  const prices = records.map(r => r.price);
  const current = prices[prices.length - 1];
  const prev = prices.length >= 2 ? prices[prices.length - 2] : null;
  const allTimeLow = Math.min(...prices);
  const allTimeHigh = Math.max(...prices);
  const change = prev != null ? ((current - prev) / prev * 100) : null;
  const isDown = change !== null && change < 0;

  // 현재가가 전체 범위에서 얼마나 저렴한지 (0% = 최저, 100% = 최고)
  const pricePercentile = allTimeHigh > allTimeLow
    ? Math.round((current - allTimeLow) / (allTimeHigh - allTimeLow) * 100)
    : 0;
  const isPriceLow = pricePercentile <= 30;
  const isPriceHigh = pricePercentile >= 70;

  const buttonStyle = (routeId: string) =>
    routeId === selected.routeId
      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300 font-semibold'
      : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-400';

  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold mb-1">📊 가격 추이</h2>
      <p className="text-xs text-slate-500 mb-3">매일 검색된 최저가 기록 · 쌀 때를 파악하는 그래프</p>

      <div className="space-y-3 mb-3">
        {japanRoutes.length > 0 && (
          <div>
            <p className="text-xs text-slate-600 mb-1.5">🇯🇵 일본</p>
            <div className="flex flex-wrap gap-1.5">
              {japanRoutes.map(r => (
                <button
                  key={r.routeId}
                  onClick={() => setSelectedId(r.routeId)}
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition ${buttonStyle(r.routeId)}`}
                >
                  {buttonLabel(r)}
                </button>
              ))}
            </div>
          </div>
        )}
        {nzRoutes.length > 0 && (
          <div>
            <p className="text-xs text-slate-600 mb-1.5">🇳🇿 뉴질랜드</p>
            <div className="flex flex-wrap gap-1.5">
              {nzRoutes.map(r => (
                <button
                  key={r.routeId}
                  onClick={() => setSelectedId(r.routeId)}
                  className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition ${buttonStyle(r.routeId)}`}
                >
                  {buttonLabel(r)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4">
        <p className="text-sm font-semibold text-white mb-2">{selected.routeName}</p>
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-2xl font-bold text-white tabular-nums">{formatKRW(current)}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {change !== null && (
                <p className={`text-xs font-semibold ${isDown ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isDown ? '▼' : '▲'} {Math.abs(change).toFixed(1)}%
                </p>
              )}
              {records.length >= 3 && (
                <p className={`text-xs font-semibold ${isPriceLow ? 'text-emerald-400' : isPriceHigh ? 'text-red-400' : 'text-slate-400'}`}>
                  {isPriceLow ? '🟢 현재 저렴' : isPriceHigh ? '🔴 현재 비쌈' : '⚪ 보통'}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500">최저 / 최고</p>
            <p className="text-xs font-bold">
              <span className="text-emerald-400">{formatKRW(allTimeLow)}</span>
              <span className="text-slate-600"> / </span>
              <span className="text-red-400">{formatKRW(allTimeHigh)}</span>
            </p>
          </div>
        </div>

        {prices.length >= 2 ? (
          <LineChart records={records} />
        ) : (
          <p className="text-xs text-slate-600 py-8 text-center">내일부터 추이가 표시됩니다</p>
        )}
        <p className="text-[10px] text-slate-600 mt-1 text-right">{records.length}일치 데이터</p>
      </div>
    </section>
  );
}
