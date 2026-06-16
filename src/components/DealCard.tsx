import type { FlightDeal } from '@/lib/types';
import { formatKRW, formatDate } from '@/lib/format';

export function DealCard({ deal, threshold = 150000 }: { deal: FlightDeal; threshold?: number }) {
  const isSpecial = deal.price <= threshold;
  return (
    <a
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl mb-3 transition active:scale-95 overflow-hidden ${
        isSpecial
          ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-900/40'
          : 'border border-gray-800'
      }`}
    >
      {isSpecial && (
        <div className="bg-amber-400 text-black text-xs font-bold px-4 py-1.5 flex items-center gap-2">
          <span>🔥 특가 — 이메일 알림 발송됨</span>
          <span className="ml-auto">{formatKRW(deal.price)}</span>
        </div>
      )}
      <div className={`p-4 flex items-start justify-between gap-2 ${isSpecial ? 'bg-amber-950' : 'bg-gray-900'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {deal.direct && <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">직항</span>}
          </div>
          <p className="font-semibold text-white truncate">{deal.routeName}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatDate(deal.departDate)} → {formatDate(deal.returnDate)}
            <span className="ml-1 text-gray-500">{deal.nights}박</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">{deal.airline}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${isSpecial ? 'text-amber-300' : 'text-white'}`}>
            {formatKRW(deal.price)}
          </p>
          <p className="text-xs text-gray-500 mb-2">1인 왕복</p>
          <span className={`text-xs px-3 py-1 rounded-full ${isSpecial ? 'bg-amber-400 text-black font-bold' : 'bg-blue-600 text-white'}`}>
            예약하기 →
          </span>
        </div>
      </div>
    </a>
  );
}
