import { NextRequest, NextResponse } from 'next/server';
import { getLatestResults, saveResults, updateHistory } from '@/lib/storage';
import type { DashboardData } from '@/lib/types';

export async function GET() {
  const data = await getLatestResults();
  if (!data) return NextResponse.json({ error: 'No data yet' }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  // TODO: 인증 재활성화 필요
  // const secret = process.env.WEBHOOK_SECRET;
  const body = await req.json() as DashboardData;
  await saveResults(body);
  await updateHistory(body);
  return NextResponse.json({ ok: true });
}
