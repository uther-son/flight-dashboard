import type { CalendarEvent } from '@/lib/types';

const ROUTINE_URL = 'https://claude.ai/code/routines/trig_01SGEsfHMZX9WBpDieqm94DQ';

// 한국 공휴일 + 여행 가능 윈도우 (주말 포함 계산)
const PUBLIC_HOLIDAYS = [
  { label: '광복절', type: 'public', start: '2026-08-13', end: '2026-08-17', nights: 4 },
  { label: '추석 연휴', type: 'public', start: '2026-09-24', end: '2026-09-29', nights: 5 },
  { label: '개천절+한글날', type: 'public', start: '2026-10-01', end: '2026-10-12', nights: 11 },
  { label: '크리스마스', type: 'public', start: '2026-12-24', end: '2026-12-27', nights: 3 },
  { label: '신정', type: 'public', start: '2026-12-31', end: '2027-01-03', nights: 3 },
  { label: '설날 연휴', type: 'public', start: '2027-01-25', end: '2027-01-31', nights: 6 },
  { label: '삼일절', type: 'public', start: '2027-02-27', end: '2027-03-02', nights: 3 },
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

function WindowCard({ label, type, start, end, nights }: {
  label: string; type: string; start: string; end: string; nights: number;
}) {
  const isPersonal = type === 'personal';
  return (
    <div className={`rounded-xl p-4 mb-3 border ${
      isPersonal
        ? 'bg-emerald-950 border-emerald-700'
        : 'bg-gray-900 border-gray-800'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              isPersonal
                ? 'bg-emerald-500 text-black'
                : 'bg-gray-700 text-gray-300'
            }`}>
              {isPersonal ? '내 휴가' : '공휴일'}
            </span>
            <span className="text-sm font-semibold text-white">{label}</span>
          </div>
          <p className="text-xs text-gray-400">{formatDateRange(start, end)}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-white">{nights}박</p>
          <p className="text-xs text-gray-500">여행 가능</p>
        </div>
      </div>
    </div>
  );
}

export function TravelCalendar({
  calendarEvents,
  updatedAt,
}: {
  calendarEvents?: CalendarEvent[];
  updatedAt?: string;
}) {
  const today = new Date();

  // 캘린더 이벤트를 여행 윈도우로 변환 (주말 포함)
  const personalWindows = (calendarEvents ?? [])
    .filter(e => isUpcoming(e.startDate))
    .map(e => {
      const start = new Date(e.startDate);
      const end = new Date(e.endDate);
      // 앞 주말 포함
      const windowStart = new Date(start);
      const day = windowStart.getDay();
      if (day === 1) windowStart.setDate(windowStart.getDate() - 2); // 월요일이면 토요일부터
      else if (day === 2) windowStart.setDate(windowStart.getDate() - 3);
      // 뒷 주말 포함
      const windowEnd = new Date(end);
      const endDay = windowEnd.getDay();
      if (endDay === 4) windowEnd.setDate(windowEnd.getDate() + 2);
      else if (endDay === 5) windowEnd.setDate(windowEnd.getDate() + 1);

      const nights = Math.round((windowEnd.getTime() - windowStart.getTime()) / 86400000);
      return {
        label: e.title,
        type: 'personal' as const,
        start: windowStart.toISOString().split('T')[0],
        end: windowEnd.toISOString().split('T')[0],
        nights,
      };
    });

  const upcomingPublic = PUBLIC_HOLIDAYS.filter(h => isUpcoming(h.start));

  const allWindows = [...personalWindows, ...upcomingPublic]
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 8);

  const syncedAt = updatedAt
    ? new Date(updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-semibold">📆 추천 여행 일자</h2>
        <a
          href={ROUTINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 transition"
        >
          캘린더 업데이트
        </a>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Google Calendar 휴가 + 한국 공휴일 기준 · 인접 주말 포함 계산
        {syncedAt && <span className="ml-2 text-gray-600">· 마지막 동기화 {syncedAt}</span>}
      </p>

      {allWindows.length === 0 ? (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center text-gray-500 text-sm">
          캘린더 업데이트 후 표시됩니다.
        </div>
      ) : (
        allWindows.map((w, i) => {
          const year = w.start.slice(0, 4);
          const prevYear = i > 0 ? allWindows[i - 1].start.slice(0, 4) : null;
          const showYear = year !== prevYear;
          return (
            <div key={i}>
              {showYear && (
                <div className="flex items-center gap-3 mb-2 mt-1">
                  <div className="flex-1 h-px bg-gray-800" />
                  <span className="text-xs font-semibold text-gray-600 tracking-widest">{year}</span>
                  <div className="flex-1 h-px bg-gray-800" />
                </div>
              )}
              <WindowCard {...w} />
            </div>
          );
        })
      )}
    </section>
  );
}
