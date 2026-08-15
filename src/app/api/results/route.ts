import { NextResponse } from 'next/server';
import { getLatestResults } from '@/lib/storage';

export async function GET() {
  const data = await getLatestResults();
  if (!data) return NextResponse.json({ error: 'No data yet' }, { status: 404 });
  return NextResponse.json(data);
}
