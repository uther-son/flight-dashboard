import { getLatestResults, getHistory } from '@/lib/storage';
import { formatKRW, formatUpdatedAt } from '@/lib/format';
import { ExpandableDealList } from '@/components/ExpandableDealList';
import { PriceTrend } from '@/components/PriceTrend';
import { TravelCalendar } from '@/components/TravelCalendar';
import { SearchButton } from '@/components/SearchButton';
import { SearchCriteriaTooltip } from '@/components/SearchCriteriaTooltip';
import { BackToTopButton } from '@/components/BackToTopButton';

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

  const japanAllDeals = data?.japanAllRoutes ?? data?.japanDeals ?? [];
  const japanSpecials = japanAllDeals.filter(d => d.price <= 150000);

  return (
    <main className="min-h-screen max-w-md mx-auto px-4 pb-10 pt-6">

      {/* 헤더 */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">✈ 항공권 특가</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {data ? `업데이트 ${formatUpdatedAt(data.updatedAt)}` : '매일 오전 10시 30분 자동 검색'}
          </p>
        </div>
        <SearchButton initialUpdatedAt={data?.updatedAt ?? null} />
      </div>

      {/* ─────────────────────────────────────────
          섹션 1: 항공권 조회
          목적: 오늘 조회된 최저가·특가 확인 후 예약 결정
      ───────────────────────────────────────── */}

      {/* 1-1. 일본 노선 */}
      <section className="mb-6">
        <h2 className="text-base font-bold mb-0.5">🇯🇵 일본 최저가</h2>
        <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5 flex-wrap">
          <span>이번달~다음달 도시별 최저가 · 직항 3박 · ₩150,000 이하 🔥 특가</span>
          <SearchCriteriaTooltip />
        </p>
        {!data ? (
          <EmptyState message="검색 결과 없음 · 오전 10시 30분 자동 검색 또는 직접 조회" />
        ) : japanAllDeals.length === 0 ? (
          <EmptyState message="현재 검색된 항공권이 없습니다" />
        ) : (
          <ExpandableDealList
            deals={japanAllDeals.slice().sort((a, b) => a.price - b.price)}
            threshold={150000}
          />
        )}
      </section>

      {/* 1-2. 뉴질랜드 노선 */}
      <section className="mb-8">
        <h2 className="text-base font-bold mb-0.5">🇳🇿 뉴질랜드</h2>
        <p className="text-xs text-slate-500 mb-3">
          ICN → AKL · 2027년 1–3월 · 28박 1인 왕복 · ₩900,000 이하 🔥 특가
        </p>
        {!data ? (
          <EmptyState message="검색 결과 없음 · 오전 10시 30분 자동 검색 또는 직접 조회" />
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

      {/* ─────────────────────────────────────────
          섹션 2: 가격 추이
          목적: 지금 가격이 역대 흐름상 저렴한지 판단
      ───────────────────────────────────────── */}
      <PriceTrend history={history} />

      {/* ─────────────────────────────────────────
          섹션 3: 추천 여행 일자
          목적: 항공권 날짜가 내 휴가·공휴일과 겹치는지 확인
      ───────────────────────────────────────── */}
      <TravelCalendar
        calendarEvents={data?.calendarEvents}
        updatedAt={data?.updatedAt}
        japanDeals={japanAllDeals}
      />

      <BackToTopButton />

    </main>
  );
}
