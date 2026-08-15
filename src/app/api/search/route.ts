import { NextRequest, NextResponse } from 'next/server';
import { getLatestResults, saveResults, updateHistory } from '@/lib/storage';
import { fetchJapanRoutes, fetchNzRoutes } from '@/lib/myrealtrip';
import type { CalendarEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// 항공권 검색의 단일 진입점. 대시보드 "지금 조회하기" 버튼(POST)과 매일 자동 실행되는
// Claude 루틴 FlightAlertDaily(GET, Vercel MCP 커넥터 경유)가 모두 이 엔드포인트 하나만 호출한다.
// calendarEvents는 루틴만 알고 있으므로, 수동 버튼처럼 전달이 없을 땐 기존 저장값을 그대로 유지한다.
async function runSearch(calendarEvents: CalendarEvent[] | undefined) {
  const today = new Date();
  const [japanRoutes, nzFlights, previous] = await Promise.all([
    fetchJapanRoutes(today),
    fetchNzRoutes(),
    calendarEvents ? Promise.resolve(null) : getLatestResults(),
  ]);

  if (japanRoutes.length === 0 && nzFlights.length === 0) {
    return NextResponse.json(
      { error: 'MCP 조회 실패 — 기존 결과 유지, 저장하지 않음' },
      { status: 502 },
    );
  }

  const data = {
    updatedAt: today.toISOString(),
    japanDeals: japanRoutes.filter(r => r.price <= 150000),
    japanAllRoutes: japanRoutes,
    nzFlights,
    calendarEvents: calendarEvents ?? previous?.calendarEvents ?? [],
  };

  await saveResults(data);
  await updateHistory(data);

  return NextResponse.json({ ok: true, ...data });
}

// Claude 루틴 전용: 네트워크 정책상 라우틴 샌드박스는 임의 도메인으로 POST를 보낼 수 없어
// Vercel MCP 커넥터의 GET 전용 fetch 도구를 사용한다. calendarEvents는 쿼리스트링으로 전달.
export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get('calendarEvents');
    const calendarEvents: CalendarEvent[] | undefined = raw ? JSON.parse(raw) : undefined;
    return await runSearch(calendarEvents);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 대시보드 "지금 조회하기" 버튼 전용
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { calendarEvents?: CalendarEvent[] };
    return await runSearch(body.calendarEvents);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
