import { NextResponse } from 'next/server';
import { saveResults, updateHistory } from '@/lib/storage';
import { fetchJapanRoutes, fetchNzRoutes } from '@/lib/myrealtrip';

export const maxDuration = 60;

export async function POST() {
  try {
    const today = new Date();
    const [japanRoutes, nzFlights] = await Promise.all([
      fetchJapanRoutes(today),
      fetchNzRoutes(),
    ]);

    if (japanRoutes.length === 0 && nzFlights.length === 0) {
      return NextResponse.json(
        { error: 'MCP 조회 실패 (인증/429 등) — 기존 결과 유지, 저장하지 않음' },
        { status: 502 },
      );
    }

    const data = {
      updatedAt: today.toISOString(),
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
