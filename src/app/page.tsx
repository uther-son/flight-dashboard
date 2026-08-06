import { getLatestResults, getHistory } from '@/lib/storage';
import { formatKRW, formatUpdatedAt } from '@/lib/format';
import { ExpandableDealList } from '@/components/ExpandableDealList';
import { PriceTrend } from '@/components/PriceTrend';
import { TravelCalendar } from '@/components/TravelCalendar';
import { SearchButton } from '@/components/SearchButton';
import { SearchCriteriaTooltip } from '@/components/SearchCriteriaTooltip';

export const dynamic = 'force-dynamic';

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-700/50 p-5 text-center text-slate-500 text-sm">
      {message}
    </div>
  );
}

export default async function Dashboard() {
  const [data, history] = await Promise.all([getLatestResults(), getHistory()]);

  return (
    <main className="min-h-screen max-w-md mx-auto px-4 pb-10 pt-6">

      {/* 헤더 */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">✈ 항공권 특가</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {data ? `업데이트 ${formatUpdatedAt(data.updatedAt)}` : '매일 오전 10시 자동 검색'}
          </p>
        </div>
        <SearchButton initialUpdatedAt={data?.updatedAt ?? null} />
      </div>

      {/* 일본 노선 */}
      <section className="mb-8">
        <h2 className="text-base font-bold mb-0.5">🇯🇵 일본</h2>
        <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5 flex-wrap">
          <span>직항 3박 · +14/+30/+45일 출발 · ₩150,000 이하 🔥 특가</span>
          <SearchCriteriaTooltip searchDates={data?.searchDates} />
        </p>
        {!data ? (
          <EmptyState message="검색 결과 없음 · 오전 10시 자동 검색 또는 직접 조회" />
        ) : (data.japanAllRoutes ?? data.japanDeals).length === 0 ? (
          <EmptyState message="현재 검색된 항공권이 없습니다" />
        ) : (
          <ExpandableDealList
            deals={(data.japanAllRoutes ?? data.japanDeals).slice().sort((a, b) => a.price - b.price)}
            threshold={150000}
          />
        )}
      </section>

      {/* 뉴질랜드 노선 */}
      <section className="mb-8">
        <h2 className="text-base font-bold mb-0.5">🇳🇿 뉴질랜드</h2>
        <p className="text-xs text-slate-500 mb-3">
          ICN → AKL · 2027년 1–3월 · 28박 1인 왕복 · ₩900,000 이하 🔥 특가
        </p>
        {!data ? (
          <EmptyState message="검색 결과 없음 · 오전 10시 자동 검색 또는 직접 조회" />
        ) : data.nzFlights.length === 0 ? (
          <EmptyState message="현재 검색된 항공권이 없습니다" />
        ) : (
          <>
            <ExpandableDealList
              deals={data.nzFlights.slice().sort((a, b) => a.price - b.price)}
              threshold={900000}
            />
            <p className="text-xs text-slate-600 mt-1 text-center">
              최저가 기준 3인 총액 {formatKRW(Math.min(...data.nzFlights.map(f => f.price)) * 3)}
            </p>
          </>
        )}
      </section>

      {/* 내 휴가 기준 (결과 있을 때만 표시) */}
      {data?.vacationSearch && data.vacationSearch.flights.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-bold mb-0.5">📅 내 휴가 기준</h2>
          <p className="text-xs text-slate-500 mb-3">
            Google Calendar 휴가 · {data.vacationSearch.period} · 일본 10개 노선
          </p>
          <ExpandableDealList
            deals={data.vacationSearch.flights.slice().sort((a, b) => a.price - b.price)}
            threshold={150000}
          />
        </section>
      )}

      {/* 추천 여행 일자 */}
      <TravelCalendar
        calendarEvents={data?.calendarEvents}
        updatedAt={data?.updatedAt}
      />

      {/* 가격 추이 */}
      <PriceTrend history={history} />

    </main>
  );
}
