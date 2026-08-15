'use client';

import { useState } from 'react';
import type { FlightHistory, RouteHistory, PriceRecord } from '@/lib/types';
import { formatKRW } from '@/lib/format';

function isNz(routeId: string): boolean {
  return routeId.includes('AKL');
}

// "도시 · 출발→도착 (YYYY-MM-DD 출발)" 또는 "후쿠오카(FUK)" 형식에서 짧은 이름만 추출.
// 뉴질랜드처럼 노선명은 같고 출발일만 다른 경우, 날짜가 있으면 그걸로 구분한다.
function buttonLabel(route: RouteHistory): string {
  const dateMatch = route.routeName.match(/\((\d{4})-(\d{2})-\d{2} 출발\)/);
  if (dateMatch) return `${Number(dateMatch[2])}월 출발`;
  const dotIdx = route.routeName.indexOf('·');
  if (dotIdx > 0) return route.routeName.slice(0, dotIdx).trim();
  const parenIdx = route.routeName.indexOf('(');
  return parenIdx > 0 ? route.routeName.slice(0, parenIdx).trim() : route.routeName;
}

function daysSince(dateStr: string): number {
  const last = new Date(dateStr);
  const today = new Date();
  last.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - last.getTime()) / 86400000);
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
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
  const routes = Object.values(history)
    .filter(r => r.records.length > 0)
    .sort((a, b) => a.routeName.localeCompare(b.routeName));
  const japanRoutes = routes.filter(r => !isNz(r.routeId));
  const nzRoutes = routes.filter(r => isNz(r.routeId));

  const [selectedId, setSelectedId] = useState(routes[0]?.routeId ?? '');

  if (routes.length === 0) return null;

  const selected = routes.find(r => r.routeId === selectedId) ?? routes[0];
  const records = [...selected.records].sort((a, b) => a.date.localeCompare(b.date));
  const prices = records.map(r => r.price);
  const current = prices[prices.length - 1];
  const currentDate = records[records.length - 1].date;
  const staleDays = daysSince(currentDate);
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
            <p className={`text-[10px] mt-1 ${staleDays >= 3 ? 'text-amber-500' : 'text-slate-600'}`}>
              {staleDays <= 0 ? '오늘' : staleDays === 1 ? '어제' : `${formatShortDate(currentDate)} (${staleDays}일 전)`} 검색 기준
              {staleDays >= 3 && ' · 최근 이 노선이 안 잡혀 오래된 가격일 수 있어요'}
            </p>
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
