import { NextRequest, NextResponse } from 'next/server';
import { getLatestResults, saveResults, updateHistory, normalizeData } from '@/lib/storage';
import type { DashboardData } from '@/lib/types';

export async function GET() {
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
  const body = normalizeData(await req.json() as DashboardData);
  await saveResults(body);
  await updateHistory(body);
  return NextResponse.json({ ok: true });
}
