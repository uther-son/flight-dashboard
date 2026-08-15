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

const WEEKENDS_AHEAD = 12; // 향후 몇 주치 주말을 후보로 볼지

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// "YYYY-MM-DD"는 어떤 실제 순간이 아니라 순수 달력 날짜로 다룬다 —
// 항상 자정 UTC로 파싱/포맷하고, 요일·일수 계산도 UTC 기준으로 일관되게 처리한다.
// (한국 시간 오프셋을 파싱에 직접 섞으면 자정 부근에서 하루가 밀리는 버그가 생김)
function parseDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// 서버는 UTC로 돌아가므로, "오늘"을 한국 시간 기준 날짜로 맞춰서 반환
function todayKst(): Date {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

// "YYYY-MM-DD"의 요일 (0=일 ~ 6=토)
function kstWeekday(dateStr: string): number {
  return parseDate(dateStr).getUTCDay();
}

function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

function formatDateRange(start: string, end: string) {
  const fmt = (s: string) =>
    parseDate(s).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
  return `${fmt(start)} ~ ${fmt(end)}`;
}

function isUpcoming(start: string) {
  return start > toDateStr(todayKst());
}

function daysUntil(start: string) {
  const diff = parseDate(start).getTime() - todayKst().getTime();
  return Math.round(diff / 86400000);
}

// 해당 여행 윈도우 안에 예약 가능한 항공권 찾기 (출발일이 윈도우 내에 있는 것)
function dealsInWindow(
  start: string,
  end: string,
  nights: number,
  deals: FlightDeal[],
): FlightDeal[] {
  const maxDeparture = addDays(end, -(nights - 1));

  return deals.filter(d => d.departDate >= start && d.departDate <= maxDeparture)
    .sort((a, b) => a.price - b.price);
}

// 매주 토요일을 기준으로 금~월(3박) 윈도우 후보 생성
function upcomingWeekends(count: number): { label: string; type: 'weekend'; start: string; end: string; nights: number }[] {
  const out = [];
  let sat = toDateStr(todayKst());
  const startWeekday = kstWeekday(sat);
  sat = addDays(sat, (6 - startWeekday + 7) % 7 || 7); // 다음 토요일부터

  for (let i = 0; i < count; i++) {
    out.push({
      label: '주말',
      type: 'weekend' as const,
      start: addDays(sat, -1), // 금
      end: addDays(sat, 2),    // 월
      nights: 3,
    });
    sat = addDays(sat, 7);
  }
  return out;
}

function cityFromName(routeName: string): string {
  const dotIdx = routeName.indexOf('·');
  if (dotIdx > 0) return routeName.slice(0, dotIdx).trim();
  return routeName;
}

const TYPE_BADGE: Record<string, string> = {
  personal: '내 휴가',
  weekend: '주말',
  public: '공휴일',
};

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
              {TYPE_BADGE[type] ?? '공휴일'}
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
      const startDay = kstWeekday(e.startDate);
      const windowStart = startDay === 1 ? addDays(e.startDate, -2) : startDay === 2 ? addDays(e.startDate, -3) : e.startDate;
      const endDay = kstWeekday(e.endDate);
      const windowEnd = endDay === 4 ? addDays(e.endDate, 2) : endDay === 5 ? addDays(e.endDate, 1) : e.endDate;
      const nights = Math.round((parseDate(windowEnd).getTime() - parseDate(windowStart).getTime()) / 86400000);
      return { label: e.title, type: 'personal' as const, start: windowStart, end: windowEnd, nights };
    });

  const upcomingPublic = PUBLIC_HOLIDAYS.filter(h => isUpcoming(h.start)).map(h => ({ ...h, type: 'public' as const }));

  // 주말은 매칭되는 항공권이 있을 때만 후보로 노출 (없으면 52주 내내 빈 카드만 나열되어 버림)
  const weekendWindows = upcomingWeekends(WEEKENDS_AHEAD)
    .filter(w => dealsInWindow(w.start, w.end, w.nights, japanDeals).length > 0);

  const allWindows = [...personalWindows, ...upcomingPublic, ...weekendWindows]
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6);

  const syncedAt = updatedAt
    ? new Date(updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })
    : null;

  return (
    <section className="mb-8">
      <h2 className="text-base font-bold mb-0.5">📆 추천 여행 일자</h2>
      <p className="text-xs text-slate-500 mb-3">
        구글 캘린더의 주말 / 공휴일 / 휴일 기준 여행 가능 일자
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
