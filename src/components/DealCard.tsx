import type { FlightDeal } from '@/lib/types';
import { formatKRW, formatDate } from '@/lib/format';

export function DealCard({ deal, threshold = 150000 }: { deal: FlightDeal; threshold?: number }) {
  const isSpecial = deal.price <= threshold;
  return (
    <a
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-2xl p-3.5 mb-2 transition active:scale-[0.98] ${
        isSpecial
          ? 'bg-amber-950/40 border border-amber-600/50'
          : 'bg-slate-900 border border-slate-700/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          {deal.direct && (
            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full leading-none">직항</span>
          )}
          {isSpecial && (
            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full leading-none font-semibold">🔥 특가</span>
          )}
        </div>
        <p className="font-semibold text-white text-[15px] leading-snug truncate">{deal.routeName}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatDate(deal.departDate)} → {formatDate(deal.returnDate)} · {deal.nights}박
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{deal.airline}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-xl font-bold tabular-nums leading-none ${isSpecial ? 'text-amber-300' : 'text-white'}`}>
          {formatKRW(deal.price)}
        </p>
        <p className="text-[10px] text-slate-500 mt-1">1인 왕복</p>
        <p className={`text-xs mt-2 font-medium ${isSpecial ? 'text-amber-400' : 'text-sky-400'}`}>예약 →</p>
      </div>
    </a>
  );
}
