import type { DashboardData, FlightDeal, FlightHistory } from './types';

// 항공사 코드 → 한국어 이름 (루틴이 인코딩 깨진 이름 보낼 때 복구용)
const AIRLINE_MAP: Record<string, string> = {
  KE: '대한항공', OZ: '아시아나항공', LJ: '진에어', TW: '티웨이항공',
  '7C': '제주항공', BX: '에어부산', ZE: '이스타항공', RF: '에어로케이',
  RS: '에어서울', YP: '에어프레미아', MM: '피치항공', JL: '일본항공',
  NH: 'ANA항공', SQ: '싱가포르항공', CX: '캐세이퍼시픽', ET: '에티하드항공',
};

// 루틴이 보내는 다양한 형식을 FlightDeal 표준으로 정규화
function normalizeDeal(raw: Record<string, unknown>): FlightDeal {
  // routeId: "route" 필드(예: "ICN→HND") 또는 routeId 필드
  const routeRaw = (raw.route as string) ?? '';
  const routeId = (raw.routeId as string) ?? routeRaw.replace('→', '_').replace(/\s/g, '');
  const routeName = (raw.routeName as string) ?? routeRaw;

  // nights: 없으면 날짜 차이로 계산
  const depart = new Date(raw.departDate as string);
  const ret = new Date(raw.returnDate as string);
  const nights = (typeof raw.nights === 'number')
    ? raw.nights
    : Math.round((ret.getTime() - depart.getTime()) / 86400000);

  // airline: airlineCode로 한국어 이름 복원 (인코딩 깨진 경우 대비)
  const airlineCode = (raw.airlineCode as string) ?? '';
  const airline = (airlineCode && AIRLINE_MAP[airlineCode])
    ? AIRLINE_MAP[airlineCode]
    : (raw.airline as string ?? '');

  return {
    routeId,
    routeName,
    departDate: raw.departDate as string,
    returnDate: raw.returnDate as string,
    nights,
    price: raw.price as number,
    airline,
    direct: typeof raw.direct === 'boolean' ? raw.direct : true,
    url: (raw.url as string) ?? 'https://www.myrealtrip.com/flights',
  };
}

function normalizeDeals(arr: unknown): FlightDeal[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => normalizeDeal(item as Record<string, unknown>));
}

export function normalizeData(data: DashboardData): DashboardData {
  return {
    ...data,
    japanDeals: normalizeDeals(data.japanDeals),
    japanAllRoutes: data.japanAllRoutes ? normalizeDeals(data.japanAllRoutes) : undefined,
    nzFlights: normalizeDeals(data.nzFlights),
    vacationSearch: data.vacationSearch ? {
      ...data.vacationSearch,
      flights: normalizeDeals(data.vacationSearch.flights),
    } : null,
  };
}

const RESULTS_KEY = 'flight_results';
const HISTORY_KEY = 'flight_history';
const MAX_RECORDS = 30;

async function upstashGet(key: string): Promise<string | null> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result ?? null;
  } catch {
    return null;
  }
}

async function upstashSet(key: string, value: string): Promise<void> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return;
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, value]]),
    });
  } catch { /* silent */ }
}

export async function getLatestResults(): Promise<DashboardData | null> {
  try {
    const raw = await upstashGet(RESULTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardData;
    return normalizeData(parsed);
  } catch {
    return null;
  }
}

export async function saveResults(data: DashboardData): Promise<void> {
  await upstashSet(RESULTS_KEY, JSON.stringify(normalizeData(data)));
}

export async function getHistory(): Promise<FlightHistory> {
  try {
    const raw = await upstashGet(HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FlightHistory;
    const cleaned: FlightHistory = {};
    for (const [key, route] of Object.entries(parsed)) {
      // 과거 버그로 생성된 쓰레기 항목 제외 (routeId 없음 또는 "undefined" 문자열 포함)
      if (!route?.routeId || route.routeId.includes('undefined')) continue;
      const records = (route.records ?? []).filter(
        r => typeof r?.price === 'number' && !Number.isNaN(r.price) && typeof r?.date === 'string'
      );
      if (records.length === 0) continue;
      cleaned[key] = { ...route, records };
    }
    return cleaned;
  } catch {
    return {};
  }
}

export async function updateHistory(data: DashboardData): Promise<void> {
  try {
    const history = await getHistory();
    const date = data.updatedAt.split('T')[0];

    // japanAllRoutes 우선, 없으면 japanDeals로 폴백
    const routes = data.japanAllRoutes ?? data.japanDeals;
    for (const deal of routes) {
      if (!history[deal.routeId]) {
        history[deal.routeId] = { routeId: deal.routeId, routeName: deal.routeName, records: [] };
      }
      history[deal.routeId].records = history[deal.routeId].records.filter(r => r.date !== date);
      history[deal.routeId].records.push({ date, price: deal.price, departDate: deal.departDate });
      history[deal.routeId].records.sort((a, b) => a.date.localeCompare(b.date));
      if (history[deal.routeId].records.length > MAX_RECORDS) {
        history[deal.routeId].records = history[deal.routeId].records.slice(-MAX_RECORDS);
      }
    }

    // NZ 추이 추적
    for (const deal of data.nzFlights) {
      const key = `${deal.routeId}_${deal.departDate}`;
      if (!history[key]) {
        history[key] = { routeId: key, routeName: `${deal.routeName} (${deal.departDate} 출발)`, records: [] };
      }
      history[key].records = history[key].records.filter(r => r.date !== date);
      history[key].records.push({ date, price: deal.price, departDate: deal.departDate });
      history[key].records.sort((a, b) => a.date.localeCompare(b.date));
      if (history[key].records.length > MAX_RECORDS) {
        history[key].records = history[key].records.slice(-MAX_RECORDS);
      }
    }

    await upstashSet(HISTORY_KEY, JSON.stringify(history));
  } catch { /* silent */ }
}
