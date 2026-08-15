import type { FlightDeal } from './types';

const MCP_URL = 'https://mcp-servers.myrealtrip.com/mcp';

// 도시별 검색 노선 (fare calendar + 직항 검색)
const JAPAN_CITIES: { city: string; routes: [string, string][] }[] = [
  { city: '도쿄',   routes: [['ICN', 'HND'], ['ICN', 'NRT'], ['GMP', 'HND']] },
  { city: '오사카', routes: [['ICN', 'KIX'], ['GMP', 'KIX']] },
  { city: '후쿠오카', routes: [['ICN', 'FUK']] },
  { city: '나고야', routes: [['ICN', 'NGO']] },
  { city: '삿포로', routes: [['ICN', 'CTS']] },
  { city: '구마모토', routes: [['ICN', 'KMJ']] },
  { city: '오키나와', routes: [['ICN', 'OKA']] },
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

function makeRouteName(city: string, origin: string, dest: string): string {
  return `${city} · ${AIRPORT_MAP[origin] ?? origin}→${AIRPORT_MAP[dest] ?? dest}`;
}

function yyyymmddToIso(s: string): string {
  if (s.includes('-')) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

interface McpFlightItem {
  airline: { code: string; name: string };
  travelInfo: { departDate: string; returnDate: string; isDirect: boolean };
  legs: Array<{ durationMinutes: number }>;
  price: { total: number };
  reservationUrl: string;
}

interface McpFlightResult {
  success: boolean;
  result?: { items: McpFlightItem[] };
}

interface FareCalendarItem {
  departureDate: string;
  returnDate: string;
  airline: string;
  totalPrice: number;
}

interface FareCalendarResponse {
  result?: {
    items?: FareCalendarItem[];
  };
}

async function callMcpTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
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

    const wrapped = rpcResult as { content?: Array<{ type: string; text: string }> };
    for (const c of wrapped.content ?? []) {
      if (c.type === 'text') return JSON.parse(c.text);
    }
    return null;
  } catch {
    return null;
  }
}

// 이번달~다음달(62일 이내) 최저가 날짜 목록 반환
async function getFareCandidates(
  origin: string,
  dest: string,
  today: Date,
): Promise<FareCalendarItem[]> {
  const raw = await callMcpTool('flightsFareCalendar', {
    from: origin,
    to: dest,
    departureDate: today.toISOString().slice(0, 10),
    period: 3,
    transfer: 0,
    maxResults: 180,
  }) as FareCalendarResponse | null;

  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 180);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return (raw?.result?.items ?? [])
    .filter(item => item.departureDate <= cutoffStr && item.departureDate > today.toISOString().slice(0, 10))
    .slice(0, 5); // 상위 5개 후보 (가장 싼 날짜들)
}

// 특정 날짜에 실제 예약 가능한 직항편 검색
async function searchFlight(
  origin: string,
  dest: string,
  departDate: string,
  returnDate: string,
  city: string,
): Promise<FlightDeal | null> {
  const raw = await callMcpTool('searchInternationalFlights', {
    tripType: 'ROUND_TRIP',
    origin,
    destination: dest,
    departDate,
    returnDate,
    directFlightOnly: true,
    maxResults: 1,
  }) as McpFlightResult | null;

  const item = raw?.result?.items?.[0];
  if (!item) return null;

  const dep = yyyymmddToIso(item.travelInfo.departDate);
  const ret = yyyymmddToIso(item.travelInfo.returnDate);
  const nights = Math.round((new Date(ret).getTime() - new Date(dep).getTime()) / 86400000);

  return {
    routeId: `${origin}_${dest}`,
    routeName: makeRouteName(city, origin, dest),
    departDate: dep,
    returnDate: ret,
    nights,
    price: item.price.total,
    airline: item.airline.name,
    direct: item.travelInfo.isDirect,
    durationMinutes: item.legs?.[0]?.durationMinutes ?? 0,
    url: item.reservationUrl,
  };
}

async function runBatched<T>(tasks: (() => Promise<T | null>)[], batchSize = 8): Promise<(T | null)[]> {
  const out: (T | null)[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const settled = await Promise.allSettled(tasks.slice(i, i + batchSize).map(t => t()));
    out.push(...settled.map(s => (s.status === 'fulfilled' ? s.value : null)));
  }
  return out;
}

export async function fetchJapanRoutes(today: Date): Promise<FlightDeal[]> {
  // Step 1: 모든 노선의 fare calendar 조회 (도시별 복수 노선 포함)
  const fareCalendarTasks = JAPAN_CITIES.flatMap(({ city, routes }) =>
    routes.map(([origin, dest]) => async () => {
      const candidates = await getFareCandidates(origin, dest, today);
      if (candidates.length === 0) return null;
      return { city, origin, dest, candidates };
    }),
  );

  const fareResults = await runBatched(fareCalendarTasks, 8);

  // Step 2: 도시별로 가장 저렴한 노선+날짜 선택
  type BestCandidate = { city: string; origin: string; dest: string; candidates: FareCalendarItem[] };
  const bestPerCity = new Map<string, BestCandidate>();

  for (const r of fareResults) {
    if (!r) continue;
    const existing = bestPerCity.get(r.city);
    if (!existing || r.candidates[0].totalPrice < existing.candidates[0].totalPrice) {
      bestPerCity.set(r.city, r);
    }
  }

  // Step 3: 실제 예약 가능한 편 검색 (fare calendar 최저가 날짜부터 최대 3개 시도)
  const bookingTasks = Array.from(bestPerCity.values()).map(({ city, origin, dest, candidates }) =>
    async () => {
      for (const candidate of candidates) {
        const deal = await searchFlight(origin, dest, candidate.departureDate, candidate.returnDate, city);
        if (deal) return deal;
      }
      return null;
    },
  );

  const deals = await runBatched(bookingTasks, 7);
  return deals.filter((d): d is FlightDeal => d !== null);
}

export async function fetchNzRoutes(): Promise<FlightDeal[]> {
  const tasks = NZ_TRIPS.map(({ departDate, returnDate }) =>
    async () => {
      const raw = await callMcpTool('searchInternationalFlights', {
        tripType: 'ROUND_TRIP',
        origin: 'ICN',
        destination: 'AKL',
        departDate,
        returnDate,
        directFlightOnly: false,
        maxResults: 1,
      }) as McpFlightResult | null;

      const item = raw?.result?.items?.[0];
      if (!item) return null;

      const dep = yyyymmddToIso(item.travelInfo.departDate);
      const ret = yyyymmddToIso(item.travelInfo.returnDate);
      const nights = Math.round((new Date(ret).getTime() - new Date(dep).getTime()) / 86400000);

      return {
        routeId: 'ICN_AKL',
        routeName: `뉴질랜드 · 인천→오클랜드`,
        departDate: dep,
        returnDate: ret,
        nights,
        price: item.price.total,
        airline: item.airline.name,
        direct: item.travelInfo.isDirect,
        durationMinutes: item.legs?.[0]?.durationMinutes ?? 0,
        url: item.reservationUrl,
      };
    },
  );

  const results = await runBatched(tasks, 3);
  return NZ_TRIPS.flatMap(({ departDate, returnDate, nights }, i) => {
    const deal = results[i];
    if (!deal) return [];
    return [{ ...deal, departDate, returnDate, nights }];
  });
}
