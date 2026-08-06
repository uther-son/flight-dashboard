import { NextResponse } from 'next/server';
import { saveResults, updateHistory } from '@/lib/storage';
import { fetchJapanRoutes, fetchNzRoutes } from '@/lib/myrealtrip';

export const maxDuration = 60;

function addDays(today: Date, days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST() {
  try {
    const today = new Date();
    const [japanRoutes, nzFlights] = await Promise.all([
      fetchJapanRoutes(today),
      fetchNzRoutes(),
    ]);

    const data = {
      updatedAt: today.toISOString(),
      searchDates: {
        plus14: addDays(today, 14),
        plus30: addDays(today, 30),
        plus45: addDays(today, 45),
      },
      japanDeals: japanRoutes.filter(r => r.price <= 150000),
      japanAllRoutes: japanRoutes,
      nzFlights,
      vacationSearch: null,
      calendarEvents: [],
    };

    await saveResults(data);
    await updateHistory(data);

    return NextResponse.json({ ok: true, updatedAt: data.updatedAt });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
