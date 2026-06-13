import type { DashboardData, FlightHistory } from './types';

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
    return JSON.parse(raw) as DashboardData;
  } catch {
    return null;
  }
}

export async function saveResults(data: DashboardData): Promise<void> {
  await upstashSet(RESULTS_KEY, JSON.stringify(data));
}

export async function getHistory(): Promise<FlightHistory> {
  try {
    const raw = await upstashGet(HISTORY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FlightHistory;
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
