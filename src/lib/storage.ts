import type { DashboardData, FlightHistory } from './types';

// 공항 코드 → 한글 지역명 (가격 추이 라벨용)
const AIRPORT_MAP: Record<string, string> = {
  ICN: '인천', GMP: '김포', HND: '하네다', NRT: '나리타', KIX: '간사이',
  FUK: '후쿠오카', NGO: '나고야', CTS: '삿포로', KMJ: '구마모토', OKA: '오키나와',
  SYD: '시드니',
};

// 가격 추이는 출발 공항(인천/김포)을 구분하지 않고 도착지 기준으로만 추적.
// 탭/카드에는 일본과 동일하게 지역명을 쓴다 — 국가명(호주)은 섹션 상단 그룹 라벨에서만 사용
function destOnlyName(dest: string): string {
  return `${AIRPORT_MAP[dest] ?? dest}(${dest})`;
}

// Redis에 저장된 값이 비어있거나 예전 스키마일 수 있으니 배열 필드만 방어적으로 채워준다.
// (/api/search가 유일한 저장 경로라 그 외의 형태 보정은 더 필요 없음)
function normalizeData(data: DashboardData): DashboardData {
  return {
    ...data,
    japanDeals: data.japanDeals ?? [],
    sydneyFlights: data.sydneyFlights ?? [],
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
      // routeName은 저장 시점이 아니라 매번 키로부터 새로 계산 — 저장된 이름이 예전
      // 네이밍 규칙 그대로 굳어버리는 걸 방지 (라벨 규칙이 바뀌면 과거 기록에도 바로 반영됨)
      cleaned[key] = { ...route, routeName: destOnlyName(key), records };
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

    // japanAllRoutes 우선, 없으면 japanDeals로 폴백. 출발 공항(인천/김포) 구분 없이 도착지 기준으로 추적.
    // 시드니도 목적지가 하나뿐이라 같은 방식으로 도착지(SYD) 기준 하나의 추이로 묶는다.
    const routes = [...(data.japanAllRoutes ?? data.japanDeals), ...data.sydneyFlights];
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

    await upstashSet(HISTORY_KEY, JSON.stringify(history));
  } catch { /* silent */ }
}
