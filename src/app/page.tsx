import { getLatestResults, getHistory } from '@/lib/storage';
import { PriceTrend } from '@/components/PriceTrend';
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
        isHot ? 'bg-amber-950 border border-amber-500' : 'bg-gray-900 border border-gray-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isHot && <span className="text-xs font-bold bg-amber-500 text-black px-2 py-0.5 rounded-full">🔥 특가</span>}
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
          <p className={`text-2xl font-bold tabular-nums ${isHot ? 'text-amber-400' : 'text-white'}`}>
            {formatKRW(deal.price)}
          </p>
          <p className="text-xs text-gray-500 mb-2">1인 왕복</p>
          <span className="text-xs bg-blue-600 text-white px-3 py-1 rounded-full">예약하기 →</span>
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

      {/* 일본 특가 */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          🇯🇵 일본 특가
          <span className="text-xs text-gray-500 font-normal">₩100,000 이하</span>
        </h2>
        {!data ? (
          <EmptyState message="검색 결과가 없습니다. 매일 오전 11시에 자동으로 검색됩니다." />
        ) : data.japanDeals.length === 0 ? (
          <EmptyState message="현재 ₩100,000 이하 특가가 없습니다." />
        ) : (
          data.japanDeals.sort((a, b) => a.price - b.price).map((deal, i) => (
            <DealCard key={i} deal={deal} threshold={100000} />
          ))
        )}
      </section>

      {/* 내 휴가 기준 */}
      {data?.vacationSearch && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            📅 내 휴가 기준
            <span className="text-xs text-gray-500 font-normal">{data.vacationSearch.period}</span>
          </h2>
          {data.vacationSearch.flights.length === 0 ? (
            <EmptyState message="해당 기간 검색된 항공권이 없습니다." />
          ) : (
            data.vacationSearch.flights.sort((a, b) => a.price - b.price).map((deal, i) => (
              <DealCard key={i} deal={deal} threshold={200000} />
            ))
          )}
        </section>
      )}

      {/* 뉴질랜드 */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
          🇳🇿 뉴질랜드 ICN→AKL
          <span className="text-xs text-gray-500 font-normal">2027 · 28박</span>
        </h2>
        {!data ? (
          <EmptyState message="검색 결과가 없습니다. 매일 오전 11시에 자동으로 검색됩니다." />
        ) : data.nzFlights.length === 0 ? (
          <EmptyState message="현재 검색된 항공권이 없습니다." />
        ) : (
          data.nzFlights.sort((a, b) => a.price - b.price).map((deal, i) => (
            <DealCard key={i} deal={deal} threshold={900000} />
          ))
        )}
        {data && data.nzFlights.length > 0 && (
          <p className="text-xs text-gray-600 mt-2 text-center">
            3인 총액 환산: {formatKRW(Math.min(...data.nzFlights.map(f => f.price)) * 3)}
          </p>
        )}
      </section>

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
