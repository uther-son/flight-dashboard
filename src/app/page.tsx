import { getLatestResults, getHistory } from '@/lib/storage';
import { PriceTrend } from '@/components/PriceTrend';
import { TravelCalendar } from '@/components/TravelCalendar';
import type { FlightDeal } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ROUTINE_URL = 'https://claude.ai/code/routines/trig_01SGEsfHMZX9WBpDieqm94DQ';

function formatKRW(n: number) {
  return `₩${n.toLocaleString('ko-KR')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', weekday: 'short',
  });
}

function formatUpdatedAt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const SPECIAL_THRESHOLD = 150000;

function DealCard({ deal }: { deal: FlightDeal }) {
  const isSpecial = deal.price <= SPECIAL_THRESHOLD;
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center text-gray-500 text-sm">
      {message}
    </div>
  );
}

export default async function Dashboard() {
  const [data, history] = await Promise.all([getLatestResults(), getHistory()]);

  return (
    <main className="min-h-screen max-w-md mx-auto px-4 pb-10 pt-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">✈ 항공권 특가</h1>
          {data ? (
            <p className="text-xs text-gray-500 mt-0.5">업데이트 {formatUpdatedAt(data.updatedAt)}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">매일 오전 11시 자동 검색</p>
          )}
        </div>
        <a
          href={ROUTINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg hover:border-gray-500 transition shrink-0"
        >
          수동 모니터링 돌리기
        </a>
      </div>

      {/* 일본 노선 최저가 */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-1">🇯🇵 일본 노선 최저가</h2>
        <p className="text-xs text-gray-500 mb-3">
          {data ? `${data.searchDates.plus14} · ${data.searchDates.plus30} · ${data.searchDates.plus45} 출발 기준 · 직항 3박` : '매일 오전 11시 자동 검색'}
          {' · '}₩150,000 이하 시 🔥 특가 표시 및 이메일 알림
        </p>
        {!data ? (
          <EmptyState message="검색 결과가 없습니다. 매일 오전 11시에 자동으로 검색됩니다." />
        ) : (data.japanAllRoutes ?? data.japanDeals).length === 0 ? (
          <EmptyState message="현재 검색된 항공권이 없습니다." />
        ) : (
          (data.japanAllRoutes ?? data.japanDeals)
            .sort((a, b) => a.price - b.price)
            .map((deal, i) => <DealCard key={i} deal={deal} />)
        )}
      </section>

      {/* 내 휴가 기준 (캘린더에 휴가 일정이 있을 때만 표시) */}
      {data?.vacationSearch && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-1">📅 내 휴가 기준 검색</h2>
          <p className="text-xs text-gray-500 mb-3">
            Google Calendar 휴가 일정 기준 · {data.vacationSearch.period} · 일본 10개 노선
          </p>
          {data.vacationSearch.flights.length === 0 ? (
            <EmptyState message="해당 기간 검색된 항공권이 없습니다." />
          ) : (
            data.vacationSearch.flights.sort((a, b) => a.price - b.price).map((deal, i) => (
              <DealCard key={i} deal={deal} />
            ))
          )}
        </section>
      )}

      {/* 뉴질랜드 노선 최저가 */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-1">🇳🇿 뉴질랜드 노선 최저가</h2>
        <p className="text-xs text-gray-500 mb-3">
          ICN→AKL · 2027년 1~3월 출발 · 28박 · 1인당 왕복 · ₩900,000 이하 시 🔥 특가 표시 및 이메일 알림
        </p>
        {!data ? (
          <EmptyState message="검색 결과가 없습니다. 매일 오전 11시에 자동으로 검색됩니다." />
        ) : data.nzFlights.length === 0 ? (
          <EmptyState message="현재 검색된 항공권이 없습니다." />
        ) : (
          <>
            {data.nzFlights.sort((a, b) => a.price - b.price).map((deal, i) => (
              <DealCard key={i} deal={deal} />
            ))}
            <p className="text-xs text-gray-600 mt-1 text-center">
              최저가 기준 3인 총액: {formatKRW(Math.min(...data.nzFlights.map(f => f.price)) * 3)}
            </p>
          </>
        )}
      </section>

      {/* 추천 여행일자 */}
      <TravelCalendar
        calendarEvents={data?.calendarEvents}
        updatedAt={data?.updatedAt}
      />

      {/* 가격 추이 */}
      <PriceTrend history={history} />

      {/* 검색 기준 */}
      {data && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-xs text-gray-500">
          <p className="font-medium text-gray-400 mb-2">검색 기준</p>
          <div className="space-y-1">
            <p>+14일: {data.searchDates.plus14} 출발 (3박)</p>
            <p>+30일: {data.searchDates.plus30} 출발 (3박)</p>
            <p>+45일: {data.searchDates.plus45} 출발 (3박)</p>
          </div>
        </div>
      )}
    </main>
  );
}
