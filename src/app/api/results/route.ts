import { NextRequest, NextResponse } from 'next/server';
import { getLatestResults, saveResults, updateHistory } from '@/lib/storage';
import type { DashboardData } from '@/lib/types';

export async function GET(req: NextRequest) {
  // 디버그 모드
  if (req.nextUrl.searchParams.get('debug') === '1') {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? 'MISSING';
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET' : 'MISSING';
    let upstashTest = 'not_tested';
    if (url !== 'MISSING') {
      try {
        const res = await fetch(`${url}/get/flight_results`, {
          headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
          cache: 'no-store',
        });
        const j = await res.json();
        upstashTest = j.result ?? 'null';
      } catch (e) {
        upstashTest = String(e);
      }
    }
    return NextResponse.json({ url: url.slice(0, 30), token, upstashTest });
  }
  const data = await getLatestResults();
  if (!data) return NextResponse.json({ error: 'No data yet' }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const secret = 'flightmonitor2026'; // env var 로드 이슈로 하드코딩
  const authHeader = req.headers.get('authorization');
  const authQuery = req.nextUrl.searchParams.get('secret');
  const provided = authHeader?.replace('Bearer ', '').trim() ?? authQuery ?? '';
  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json() as DashboardData;
  await saveResults(body);
  await updateHistory(body);
  return NextResponse.json({ ok: true });
}
