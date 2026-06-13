import { getLatestResults } from '@/lib/storage';
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

function DealCard({ deal, threshold }: { deal: FlightDeal; threshold: number }) {
  const isHot = deal.price <= threshold;
  return (
    <a
      href={deal.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl p-4 mb-3 transition active:scale-95 ${
        isHot
          ? 'bg-amber-950 border border-amber-500'
          : 'bg-gray-900 border border-gray-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isHot && <span className="text-xs font-bold bg-amber-500 text-black px-2 py-0.5 rounded-full">🔥 특가</span>}
            {deal.direct && <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">직항</span>}
          </div>
          <p className="font-semibold text-white">{deal.routeName}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatDate(deal.departDate)} → {formatDate(deal.returnDate)}
            <span className="ml-1 text-gray-500">{deal.nights}박</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">{deal.airline}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold tabular-nums ${isHot ? 'text-amber-400' : 'text-white'}`}>
            {formatKRW(deal.price)}
          </p>
          <p className="text-xs text-gray-500">1인 왕복</p>
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
  const data = await getLatestResults();

  return (
    <main className="min-h-screen max-w-md mx-auto px-4 pb-28 pt-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">✈ 항공권 특가</h1>
          {data ? (
            <p className="text-xs text-gray-500 mt-0.5">업데이트 {formatUpdatedAt(data.updatedAt)}</p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">아직 데이터 없음</p>
          )}
        </div>
        <a
          href={ROUTINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-full transition"
        >
          지금 검색
        </a>
      </div>

      {/* 일본 특가 */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          🇯🇵 일본 특가
          <span className="text-xs text-gray-500 font-normal">₩100,000 이하</span>
        </h2>
        {!data || data.japanDeals.length === 0 ? (
          <EmptyState message="이번 주기 특가 없음 — 내일 오전 11시 재검색" />
        ) : (
          data.japanDeals
            .sort((a, b) => a.price - b.price)
            .map((deal, i) => <DealCard key={i} deal={deal} threshold={100000} />)
        )}
      </section>

      {/* 내 휴가 기준 검색 */}
      {data?.vacationSearch && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            📅 내 휴가 기준
            <span className="text-xs text-gray-500 font-normal">{data.vacationSearch.period}</span>
          </h2>
          {data.vacationSearch.flights.length === 0 ? (
            <EmptyState message="해당 기간 검색 결과 없음" />
          ) : (
            data.vacationSearch.flights
              .sort((a, b) => a.price - b.price)
              .map((deal, i) => <DealCard key={i} deal={deal} threshold={200000} />)
          )}
        </section>
      )}

      {/* 뉴질랜드 */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          🇳🇿 뉴질랜드 ICN→AKL
          <span className="text-xs text-gray-500 font-normal">2027년 1~3월 · 28박</span>
        </h2>
        {!data || data.nzFlights.length === 0 ? (
          <EmptyState message="검색 결과 없음" />
        ) : (
          data.nzFlights
            .sort((a, b) => a.price - b.price)
            .map((deal, i) => (
              <DealCard key={i} deal={deal} threshold={900000} />
            ))
        )}
        {data && data.nzFlights.length > 0 && (
          <p className="text-xs text-gray-600 mt-2 text-center">
            3인 총액 환산: {formatKRW(Math.min(...data.nzFlights.map(f => f.price)) * 3)}
          </p>
        )}
      </section>

      {/* 검색 기준 날짜 */}
      {data && (
        <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-xs text-gray-500">
          <p className="font-medium text-gray-400 mb-2">검색 기준 날짜</p>
          <div className="space-y-1">
            <p>+14일: {data.searchDates.plus14} 출발</p>
            <p>+30일: {data.searchDates.plus30} 출발</p>
            <p>+45일: {data.searchDates.plus45} 출발</p>
          </div>
        </div>
      )}

      {/* 하단 검색 버튼 */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4">
        <a
          href={ROUTINE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-center font-bold py-4 rounded-2xl shadow-lg shadow-blue-950 transition"
        >
          🔍 지금 검색하기
        </a>
      </div>
    </main>
  );
}
