import type { CalendarEvent, FlightDeal } from '@/lib/types';
import { formatKRW } from '@/lib/format';

const PUBLIC_HOLIDAYS = [
  { label: '광복절', start: '2026-08-13', end: '2026-08-17', nights: 4 },
  { label: '추석 연휴', start: '2026-09-24', end: '2026-09-29', nights: 5 },
  { label: '개천절+한글날', start: '2026-10-01', end: '2026-10-12', nights: 11 },
  { label: '크리스마스', start: '2026-12-24', end: '2026-12-27', nights: 3 },
  { label: '신정', start: '2026-12-31', end: '2027-01-03', nights: 3 },
  { label: '설날 연휴', start: '2027-01-25', end: '2027-01-31', nights: 6 },
  { label: '삼일절', start: '2027-02-27', end: '2027-03-02', nights: 3 },
];

function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
  return `${fmt(s)} ~ ${fmt(e)}`;
}

function isUpcoming(start: string) {
  return new Date(start) > new Date();
}

function daysUntil(start: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(start);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// 해당 여행 윈도우 안에 예약 가능한 항공권 찾기 (출발일이 윈도우 내에 있는 것)
function dealsInWindow(
  start: string,
  end: string,
  nights: number,
  deals: FlightDeal[],
): FlightDeal[] {
  const windowStart = new Date(start);
  const windowEnd = new Date(end);
  // 출발일 + nights일이 윈도우 종료일 이전이어야 함
  const maxDeparture = new Date(windowEnd);
  maxDeparture.setDate(maxDeparture.getDate() - nights + 1);

  return deals.filter(d => {
    const dep = new Date(d.departDate);
    return dep >= windowStart && dep <= maxDeparture;
  }).sort((a, b) => a.price - b.price);
}

function cityFromName(routeName: string): string {
  const dotIdx = routeName.indexOf('·');
  if (dotIdx > 0) return routeName.slice(0, dotIdx).trim();
  return routeName;
}

function WindowCard({ label, type, start, end, nights, matchedDeals }: {
  label: string; type: string; start: string; end: string; nights: number;
  matchedDeals: FlightDeal[];
}) {
  const isPersonal = type === 'personal';
  const bestDeal = matchedDeals[0];

  return (
    <div className={`rounded-2xl p-4 mb-2 border ${
      bestDeal
        ? 'bg-emerald-950/40 border-emerald-700/50'
        : isPersonal
        ? 'bg-slate-800 border-slate-600/50'
        : 'bg-slate-900 border-slate-700/50'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              isPersonal ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-700 text-slate-300'
            }`}>
              {isPersonal ? '내 휴가' : '공휴일'}
            </span>
            <span className="text-sm font-semibold text-white truncate">{label}</span>
          </div>
          <p className="text-xs text-slate-400">{formatDateRange(start, end)}</p>
          {bestDeal && (
            <div className="mt-2 space-y-0.5">
              {matchedDeals.slice(0, 2).map((deal, i) => (
                <a
                  key={i}
                  href={deal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200"
                >
                  ✈ {cityFromName(deal.routeName)}
                  <span className="font-bold tabular-nums">{formatKRW(deal.price)}</span>
                  <span className="text-emerald-600">· {deal.departDate.slice(5)} 출발 →</span>
                </a>
              ))}
              {matchedDeals.length > 2 && (
                <p className="text-[10px] text-emerald-700">+{matchedDeals.length - 2}개 노선 더보기</p>
              )}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-white">{nights}박</p>
          <p className="text-xs text-slate-500">D-{daysUntil(start)}</p>
          {bestDeal && <p className="text-[10px] text-emerald-500 mt-0.5">항공권 ✓</p>}
        </div>
      </div>
    </div>
  );
}

export function TravelCalendar({
  calendarEvents,
  updatedAt,
  japanDeals = [],
}: {
  calendarEvents?: CalendarEvent[];
  updatedAt?: string;
  japanDeals?: FlightDeal[];
}) {
  const personalWindows = (calendarEvents ?? [])
    .filter(e => isUpcoming(e.startDate))
    .map(e => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      const windowStart = new Date(start);
      const day = windowStart.getDay();
      if (day === 1) windowStart.setDate(windowStart.getDate() - 2);
      else if (day === 2) windowStart.setDate(windowStart.getDate() - 3);
      const windowEnd = new Date(end);
      const endDay = windowEnd.getDay();
      if (endDay === 4) windowEnd.setDate(windowEnd.getDate() + 2);
      else if (endDay === 5) windowEnd.setDate(windowEnd.getDate() + 1);
      const nights = Math.round((windowEnd.getTime() - windowStart.getTime()) / 86400000);
      return {
        label: e.title, type: 'personal' as const,
        start: windowStart.toISOString().split('T')[0],
        end: windowEnd.toISOString().split('T')[0],
        nights,
      };
    });

  const upcomingPublic = PUBLIC_HOLIDAYS.filter(h => isUpcoming(h.start)).map(h => ({ ...h, type: 'public' as const }));
  const allWindows = [...personalWindows, ...upcomingPublic]
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6);

  const syncedAt = updatedAt
    ? new Date(updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <section className="mb-8">
      <h2 className="text-base font-bold mb-0.5">📆 추천 여행 일자</h2>
      <p className="text-xs text-slate-500 mb-3">
        공휴일·내 휴가 기준 여행 가능 윈도우 · 항공권 있으면 ✓ 표시
        {syncedAt && <span className="ml-1 text-slate-600">· 동기화 {syncedAt}</span>}
      </p>

      {allWindows.length === 0 ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5 text-center text-slate-500 text-sm">
          일정 없음 · 캘린더 동기화 후 표시됩니다
        </div>
      ) : (
        allWindows.map((w, i) => {
          const year = w.start.slice(0, 4);
          const prevYear = i > 0 ? allWindows[i - 1].start.slice(0, 4) : null;
          const showYear = year !== prevYear;
          const matched = dealsInWindow(w.start, w.end, 3, japanDeals);
          return (
            <div key={i}>
              {showYear && (
                <div className="flex items-center gap-3 mb-2 mt-1">
                  <div className="flex-1 h-px bg-slate-800" />
                  <span className="text-xs font-semibold text-slate-600 tracking-widest">{year}</span>
                  <div className="flex-1 h-px bg-slate-800" />
                </div>
              )}
              <WindowCard {...w} matchedDeals={matched} />
            </div>
          );
        })
      )}
    </section>
  );
}
