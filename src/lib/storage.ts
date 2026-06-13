import type { DashboardData } from './types';

const KEY = 'flight_results'; // 콜론 제거 (URL 파싱 오류 방지)

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
    // Upstash pipeline format
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['SET', key, value]]),
    });
  } catch {
    // silent fail
  }
}

export async function getLatestResults(): Promise<DashboardData | null> {
  try {
    const raw = await upstashGet(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DashboardData;
  } catch {
    return null;
  }
}

export async function saveResults(data: DashboardData): Promise<void> {
  await upstashSet(KEY, JSON.stringify(data));
}
