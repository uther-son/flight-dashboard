import type { RouteHistory } from '@/lib/types';

function formatKRW(n: number) {
  return `₩${n.toLocaleString('ko-KR')}`;
}

function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return null;
  const W = 100, H = 32, PAD = 3;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const pts = prices.map((p, i) => {
    const x = PAD + (i / (prices.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((p - min) / range) * (H - PAD * 2);
    return [x, y] as [number, number];
  });

  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  const isDown = prices[prices.length - 1] <= prices[prices.length - 2];
  const color = isDown ? '#4ade80' : '#f87171';

  return (
    <svg width={W} height={H} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="2.5" fill={color} />
    </svg>
  );
}

function RouteCard({ route }: { route: RouteHistory }) {
  const records = [...route.records].sort((a, b) => a.date.localeCompare(b.date));
  const prices = records.map(r => r.price);
  const current = prices[prices.length - 1];
  const prev = prices.length >= 2 ? prices[prices.length - 2] : null;
  const allTimeLow = Math.min(...prices);
  const change = prev != null ? ((current - prev) / prev * 100) : null;
  const isDown = change !== null && change < 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{route.routeName}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            역대 최저 {formatKRW(allTimeLow)} · {records.length}일치 데이터
          </p>
          <div className="mt-2">
            {prices.length >= 2
              ? <Sparkline prices={prices} />
              : <p className="text-xs text-gray-600">내일부터 추이 표시</p>
            }
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-white tabular-nums">{formatKRW(current)}</p>
          {change !== null ? (
            <p className={`text-xs font-semibold mt-0.5 ${isDown ? 'text-green-400' : 'text-red-400'}`}>
              {isDown ? '▼' : '▲'} {Math.abs(change).toFixed(1)}%
            </p>
          ) : (
            <p className="text-xs text-gray-600 mt-0.5">전일 비교 없음</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PriceTrend({ history }: { history: FlightHistory }) {
  // 일본 노선만 (NZ 제외)
  const japanRoutes = Object.values(history)
    .filter(r => !r.routeId.includes('_202'))
    .filter(r => r.records.length > 0)
    .sort((a, b) => {
      const ap = a.records[a.records.length - 1].price;
      const bp = b.records[b.records.length - 1].price;
      return ap - bp;
    });

  const nzRoutes = Object.values(history)
    .filter(r => r.routeId.includes('_202'))
    .filter(r => r.records.length > 0)
    .sort((a, b) => a.routeId.localeCompare(b.routeId));

  if (japanRoutes.length === 0 && nzRoutes.length === 0) return null;

  return (
    <>
      {japanRoutes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-1">📊 일본 노선 가격 추이</h2>
          <p className="text-xs text-gray-500 mb-3">역대 최저가 · 전일 대비 증감</p>
          {japanRoutes.map(r => <RouteCard key={r.routeId} route={r} />)}
        </section>
      )}
      {nzRoutes.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-1">📊 뉴질랜드 가격 추이</h2>
          <p className="text-xs text-gray-500 mb-3">출발일별 1인당 최저가 변화</p>
          {nzRoutes.map(r => <RouteCard key={r.routeId} route={r} />)}
        </section>
      )}
    </>
  );
}

type FlightHistory = { [routeId: string]: RouteHistory };
