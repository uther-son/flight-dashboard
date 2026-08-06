import { NextRequest, NextResponse } from 'next/server';
import { saveResults, updateHistory } from '@/lib/storage';
import { fetchJapanRoutes, fetchNzRoutes } from '@/lib/myrealtrip';
import type { DashboardData } from '@/lib/types';

export const maxDuration = 60;

function addDays(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 자동 추가
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    const [japanDeals, nzFlights] = await Promise.all([
      fetchJapanRoutes(today),
      fetchNzRoutes(),
    ]);

    const data: DashboardData = {
      updatedAt: today.toISOString(),
      searchDates: {
        plus14: addDays(today, 14),
        plus30: addDays(today, 30),
        plus45: addDays(today, 45),
      },
      japanDeals: [],
      japanAllRoutes: japanDeals,
      nzFlights,
      vacationSearch: null,
    };

    await saveResults(data);
    await updateHistory(data);

    return NextResponse.json({
      ok: true,
      updatedAt: data.updatedAt,
      japanRoutes: japanDeals.length,
      nzFlights: nzFlights.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
