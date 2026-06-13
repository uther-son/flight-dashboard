import { NextRequest, NextResponse } from 'next/server';
import { getLatestResults, saveResults, updateHistory } from '@/lib/storage';
import type { DashboardData } from '@/lib/types';

export async function GET() {
  const data = await getLatestResults();
  if (!data) return NextResponse.json({ error: 'No data yet' }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json() as DashboardData;
  await saveResults(body);
  await updateHistory(body);
  return NextResponse.json({ ok: true });
}
