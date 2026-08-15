import type { DashboardData, FlightDeal, FlightHistory } from './types';

// 항공사 코드 → 한국어 이름 (루틴이 인코딩 깨진 이름 보낼 때 복구용)
const AIRLINE_MAP: Record<string, string> = {
  KE: '대한항공', OZ: '아시아나항공', LJ: '진에어', TW: '티웨이항공',
  '7C': '제주항공', BX: '에어부산', ZE: '이스타항공', RF: '에어로케이',
  RS: '에어서울', YP: '에어프레미아', MM: '피치항공', JL: '일본항공',
  NH: 'ANA항공', SQ: '싱가포르항공', CX: '캐세이퍼시픽', ET: '에티하드항공',
};

// 공항 코드 → 한글 지역명 (노선명 표기 통일용: "인천(ICN) → 후쿠오카(FUK)")
const AIRPORT_MAP: Record<string, string> = {
  ICN: '인천', GMP: '김포', HND: '하네다', NRT: '나리타', KIX: '간사이',
  FUK: '후쿠오카', NGO: '나고야', CTS: '삿포로', KMJ: '구마모토', OKA: '오키나와',
  AKL: '오클랜드',
};

function formatRouteName(origin: string, dest: string): string {
  const originName = AIRPORT_MAP[origin] ?? origin;
  const destName = AIRPORT_MAP[dest] ?? dest;
  return `${originName}(${origin}) → ${destName}(${dest})`;
}

// 가격 추이는 출발 공항(인천/김포)을 구분하지 않고 도착지 기준으로만 추적
function destOnlyName(dest: string): string {
  return `${AIRPORT_MAP[dest] ?? dest}(${dest})`;
}

// "ICN→HND" / "ICN-HND" / "ICN_HND" / "ICN->HND" 등 다양한 구분자에서 공항 코드 2개 추출
function parseRouteCodes(raw: Record<string, unknown>): [string, string] | null {
  const source = (raw.route as string) ?? (raw.routeId as string) ?? '';
  const normalized = source.replace(/→/g, ' ').replace(/->/g, ' ').replace(/[-_]/g, ' ');
  const parts = normalized.split(/\s+/).map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s));
  if (parts.length >= 2) {
    return [parts[0], parts[parts.length - 1]];
  }
  return null;
}

// 루틴이 보내는 다양한 형식을 FlightDeal 표준으로 정규화
function normalizeDeal(raw: Record<string, unknown>, defaultRoute?: [string, string]): FlightDeal {
  const codes = parseRouteCodes(raw) ?? defaultRoute ?? null;
  const [origin, dest] = codes ?? ['', ''];
  const routeId = origin && dest ? `${origin}_${dest}` : ((raw.routeId as string) || (raw.route as string) || '');
  // Preserve city-level names (format: "도시 · 출발→도착") from myrealtrip.ts
  const storedName = raw.routeName as string;
  const routeName = (storedName?.includes('·'))
    ? storedName
    : (origin && dest ? formatRouteName(origin, dest) : (storedName || routeId));

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
    durationMinutes: typeof raw.durationMinutes === 'number' ? raw.durationMinutes : 0,
    url: ((raw.url as string) || (raw.reservationUrl as string) || 'https://www.myrealtrip.com/flights'),
  };
}

function normalizeDeals(arr: unknown, defaultRoute?: [string, string]): FlightDeal[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => normalizeDeal(item as Record<string, unknown>, defaultRoute));
}

export function normalizeData(data: DashboardData): DashboardData {
  // 루틴이 보내는 필드명 변형 처리: japanRoutes→japanDeals, nzRoutes→nzFlights, runAt→updatedAt
  const raw = data as unknown as Record<string, unknown>;
  const japanSrc = (data.japanDeals?.length ? data.japanDeals : raw.japanRoutes) as unknown[] | undefined ?? [];
  const japanAllSrc = (data.japanAllRoutes ?? raw.japanAllRoutes) as unknown[] | undefined;
  const nzSrc = (data.nzFlights?.length ? data.nzFlights : raw.nzRoutes) as unknown[] | undefined ?? [];
  const updatedAt = data.updatedAt || (raw.runAt as string) || new Date().toISOString();

  return {
    ...data,
    updatedAt,
    japanDeals: normalizeDeals(japanSrc),
    japanAllRoutes: japanAllSrc ? normalizeDeals(japanAllSrc) : undefined,
    nzFlights: normalizeDeals(nzSrc, ['ICN', 'AKL']),
  };
}

const RESULTS_KEY = 'flight_results';
const HISTORY_KEY = 'flight_history';
const MAX_RECORDS = 365;

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
      if (!route?.routeId) continue;
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

    // japanAllRoutes 우선, 없으면 japanDeals로 폴백. 출발 공항(인천/김포) 구분 없이 도착지 기준으로 추적
    const routes = data.japanAllRoutes ?? data.japanDeals;
    for (const deal of routes) {
      const dest = deal.routeId.split(/[_-]/).pop() || deal.routeId;
      if (!history[dest]) {
        history[dest] = { routeId: dest, routeName: destOnlyName(dest), records: [] };
      }
      history[dest].records = history[dest].records.filter(r => r.date !== date);
      history[dest].records.push({ date, price: deal.price, departDate: deal.departDate });
      history[dest].records.sort((a, b) => a.date.localeCompare(b.date));
      if (history[dest].records.length > MAX_RECORDS) {
        history[dest].records = history[dest].records.slice(-MAX_RECORDS);
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
