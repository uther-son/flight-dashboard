import type { FlightDeal } from './types';

const MCP_URL = 'https://mcp-servers.myrealtrip.com/mcp';

const JAPAN_ROUTES: [string, string][] = [
  ['ICN', 'HND'], ['ICN', 'NRT'], ['ICN', 'KIX'], ['ICN', 'FUK'],
  ['ICN', 'NGO'], ['ICN', 'CTS'], ['ICN', 'KMJ'], ['ICN', 'OKA'],
  ['GMP', 'HND'], ['GMP', 'KIX'],
];

const NZ_TRIPS = [
  { departDate: '2027-01-05', returnDate: '2027-02-02', nights: 28 },
  { departDate: '2027-02-01', returnDate: '2027-03-01', nights: 28 },
  { departDate: '2027-03-01', returnDate: '2027-03-29', nights: 28 },
];

const AIRPORT_MAP: Record<string, string> = {
  ICN: '인천', GMP: '김포', HND: '하네다', NRT: '나리타', KIX: '간사이',
  FUK: '후쿠오카', NGO: '나고야', CTS: '삿포로', KMJ: '구마모토', OKA: '오키나와',
  AKL: '오클랜드',
};

function makeRouteName(origin: string, dest: string): string {
  return `${AIRPORT_MAP[origin] ?? origin}(${origin}) → ${AIRPORT_MAP[dest] ?? dest}(${dest})`;
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function yyyymmddToIso(s: string): string {
  // "20260825" → "2026-08-25"
  if (s.includes('-')) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

interface McpFlightItem {
  airline: { code: string; name: string };
  travelInfo: { departDate: string; returnDate: string; isDirect: boolean };
  price: { total: number };
  reservationUrl: string;
}

interface McpFlightResult {
  success: boolean;
  result?: { items: McpFlightItem[] };
  error?: string;
}

async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    const res = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();

    let rpcResult: unknown = null;

    if (contentType.includes('text/event-stream')) {
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const d = JSON.parse(line.slice(6)) as { result?: unknown };
            if (d.result) { rpcResult = d.result; break; }
          } catch { continue; }
        }
      }
    } else {
      const json = JSON.parse(text) as { result?: unknown };
      rpcResult = json.result ?? null;
    }

    if (!rpcResult) return null;

    // MCP wraps tool output in content[].text
    const wrapped = rpcResult as { content?: Array<{ type: string; text: string }> };
    for (const c of wrapped.content ?? []) {
      if (c.type === 'text') {
        return JSON.parse(c.text);
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function searchFlight(
  origin: string,
  dest: string,
  departDate: string,
  returnDate: string,
  directOnly: boolean,
): Promise<FlightDeal | null> {
  const raw = await callMcpTool('searchInternationalFlights', {
    tripType: 'ROUND_TRIP',
    origin,
    destination: dest,
    departDate,
    returnDate,
    directFlightOnly: directOnly,
    maxResults: 1,
  }) as McpFlightResult | null;

  const item = raw?.result?.items?.[0];
  if (!item) return null;

  const dep = yyyymmddToIso(item.travelInfo.departDate);
  const ret = yyyymmddToIso(item.travelInfo.returnDate);
  const nights = Math.round(
    (new Date(ret).getTime() - new Date(dep).getTime()) / 86400000,
  );

  return {
    routeId: `${origin}_${dest}`,
    routeName: makeRouteName(origin, dest),
    departDate: dep,
    returnDate: ret,
    nights,
    price: item.price.total,
    airline: item.airline.name,
    direct: item.travelInfo.isDirect,
    url: item.reservationUrl,
  };
}

async function runBatched<T>(
  tasks: (() => Promise<T | null>)[],
  batchSize = 8,
): Promise<(T | null)[]> {
  const out: (T | null)[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const settled = await Promise.allSettled(
      tasks.slice(i, i + batchSize).map(t => t()),
    );
    out.push(...settled.map(s => (s.status === 'fulfilled' ? s.value : null)));
  }
  return out;
}

export async function fetchJapanRoutes(today: Date): Promise<FlightDeal[]> {
  const datePairs: [string, string][] = [
    [addDays(today, 14), addDays(today, 17)], // +14일 3박
    [addDays(today, 30), addDays(today, 33)], // +30일 3박
    [addDays(today, 45), addDays(today, 48)], // +45일 3박
  ];

  // 10노선 × 3날짜 = 30개 병렬 검색 (배치 8개씩)
  const tasks = JAPAN_ROUTES.flatMap(([origin, dest]) =>
    datePairs.map(([dep, ret]) => () => searchFlight(origin, dest, dep, ret, true)),
  );

  const results = await runBatched(tasks, 8);

  // 노선별 최저가 추출
  const bestByRoute = new Map<string, FlightDeal>();
  JAPAN_ROUTES.forEach(([origin, dest], ri) => {
    datePairs.forEach((_, di) => {
      const deal = results[ri * datePairs.length + di];
      if (!deal) return;
      const key = `${origin}_${dest}`;
      const cur = bestByRoute.get(key);
      if (!cur || deal.price < cur.price) bestByRoute.set(key, deal);
    });
  });

  return Array.from(bestByRoute.values());
}

export async function fetchNzRoutes(): Promise<FlightDeal[]> {
  const tasks = NZ_TRIPS.map(({ departDate, returnDate }) =>
    () => searchFlight('ICN', 'AKL', departDate, returnDate, false),
  );

  const results = await runBatched(tasks, 3);

  return NZ_TRIPS.flatMap(({ departDate, returnDate, nights }, i) => {
    const deal = results[i];
    if (!deal) return [];
    // nights override: API 계산값 대신 고정 28박 적용
    return [{ ...deal, departDate, returnDate, nights }];
  });
}
