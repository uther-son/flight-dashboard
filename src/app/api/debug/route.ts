import { NextResponse } from 'next/server';
import { getHistory } from '@/lib/storage';

export async function GET() {
  const history = await getHistory();
  const entries = Object.entries(history).map(([key, route]) => ({
    key,
    routeId: route.routeId,
    routeName: route.routeName,
    recordCount: route.records.length,
  }));
  return NextResponse.json({ count: entries.length, entries });
}
