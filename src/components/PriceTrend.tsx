'use client';

import { useMemo, useState } from 'react';
import type { FlightHistory } from '@/lib/types';
import { formatKRW } from '@/lib/format';

// routeId(예: "ICN_FUK", NZ는 "ICN_AKL_2027-01-05")에서 탭에 쓸 짧은 라벨 생성
function shortLabel(routeId: string) {
  const dateMatch = routeId.match(/_(\d{4})-(\d{2})-(\d{2})$/);
  const base = dateMatch ? routeId.slice(0, dateMatch.index) : routeId;
  const parts = base.split('_').filter(Boolean);
  const codeLabel = parts.length >= 2 ? `${parts[0]}→${parts[1]}` : base;
  return dateMatch ? `${codeLabel} ${Number(dateMatch[2])}/${Number(dateMatch[3])}` : codeLabel;
}

function LineChart({ records }: { records: { date: string; price: number }[] }) {
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
  const [minX, minY] = pts[minIdx];
  const labelAbove = minY > 16;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
      <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === minIdx ? 3.5 : 2} fill={i === minIdx ? '#4ade80' : '#60a5fa'} />
      ))}
      <text
        x={minX}
        y={labelAbove ? minY - 8 : minY + 14}
        textAnchor="middle"
        fontSize="11"
        fill="#4ade80"
        fontWeight="bold"
      >
        {formatKRW(min)}
      </text>
    </svg>
  );
}

export function PriceTrend({ history }: { history: FlightHistory }) {
  const routes = useMemo(
    () => Object.values(history)
      .filter(r => r.records.length > 0)
      .sort((a, b) => a.routeName.localeCompare(b.routeName)),
    [history]
  );

  const japanRoutes = routes.filter(r => !r.routeId.includes('_202'));
  const nzRoutes = routes.filter(r => r.routeId.includes('_202'));

  const [selectedId, setSelectedId] = useState(routes[0]?.routeId ?? '');

  if (routes.length === 0) return null;

  const selected = routes.find(r => r.routeId === selectedId) ?? routes[0];
  const records = [...selected.records].sort((a, b) => a.date.localeCompare(b.date));
  const prices = records.map(r => r.price);
  const current = prices[prices.length - 1];
  const prev = prices.length >= 2 ? prices[prices.length - 2] : null;
  const allTimeLow = Math.min(...prices);
  const change = prev != null ? ((current - prev) / prev * 100) : null;
  const isDown = change !== null && change < 0;

  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold mb-1">📊 가격 추이</h2>
      <p className="text-xs text-gray-500 mb-3">노선을 선택하면 가격 변화를 확인할 수 있습니다</p>

      <div className="space-y-2 mb-3">
        {japanRoutes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {japanRoutes.map(r => (
              <button
                key={r.routeId}
                onClick={() => setSelectedId(r.routeId)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition ${
                  r.routeId === selected.routeId
                    ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                {shortLabel(r.routeId)}
              </button>
            ))}
          </div>
        )}
        {nzRoutes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {nzRoutes.map(r => (
              <button
                key={r.routeId}
                onClick={() => setSelectedId(r.routeId)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full border transition ${
                  r.routeId === selected.routeId
                    ? 'bg-blue-600 border-blue-600 text-white font-semibold'
                    : 'border-gray-700 text-gray-400'
                }`}
              >
                {shortLabel(r.routeId)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-sm font-semibold text-white mb-2">{selected.routeName}</p>
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-2xl font-bold text-white tabular-nums">{formatKRW(current)}</p>
            {change !== null ? (
              <p className={`text-xs font-semibold mt-0.5 ${isDown ? 'text-green-400' : 'text-red-400'}`}>
                {isDown ? '▼' : '▲'} {Math.abs(change).toFixed(1)}% (전일 대비)
              </p>
            ) : (
              <p className="text-xs text-gray-600 mt-0.5">전일 비교 없음</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">역대 최저가</p>
            <p className="text-sm font-bold text-green-400">{formatKRW(allTimeLow)}</p>
          </div>
        </div>

        {prices.length >= 2 ? (
          <LineChart records={records} />
        ) : (
          <p className="text-xs text-gray-600 py-8 text-center">내일부터 추이가 표시됩니다</p>
        )}
        <p className="text-xs text-gray-600 mt-1 text-right">{records.length}일치 데이터</p>
      </div>
    </section>
  );
}
