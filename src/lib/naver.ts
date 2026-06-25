import type { FlightDeal } from './types';

const API_URL = 'https://flight-api.naver.com/flight/international/searchFlights';

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

function routeName(origin: string, dest: string): string {
  return `${AIRPORT_MAP[origin] ?? origin}(${origin}) → ${AIRPORT_MAP[dest] ?? dest}(${dest})`;
}

function naverUrl(origin: string, dest: string, dep: string, ret: string): string {
  const d = dep.replace(/-/g, ''), r = ret.replace(/-/g, '');
  return `https://flight.naver.com/flights/international/${origin}-${dest}-${d}/${dest}-${origin}-${r}?adult=1&isDirect=true&fareType=Y`;
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface RouteResult {
  price: number;
  airline: string;
  airlineCode: string;
  departDate: string;
  returnDate: string;
}

async function searchRoute(
  origin: string,
  dest: string,
  departDate: string,
  returnDate: string,
  direct: boolean,
  timeoutMs = 8000,
): Promise<RouteResult | null> {
  const dFmt = departDate.replace(/-/g, '');
  const rFmt = returnDate.replace(/-/g, '');

  const body = {
    adultCount: 1, childCount: 0, infantCount: 0,
    device: 'pc',
    isNonstop: direct,
    itineraries: [
      { departureLocationCode: origin, departureLocationType: 'airport', arrivalLocationCode: dest, arrivalLocationType: 'airport', departureDate: dFmt },
      { departureLocationCode: dest, departureLocationType: 'airport', arrivalLocationCode: origin, arrivalLocationType: 'airport', departureDate: rFmt },
    ],
    openReturnDays: 0,
    seatClass: 'Y',
    tripType: 'RT',
    flightFilter: {
      filter: {
        airlines: [], departureAirports: [[origin], [dest]], arrivalAirports: [[dest], [origin]],
        departureTime: [], fareTypes: [], flightDurationSeconds: [],
        hasCardBenefit: false, isIndividual: false, isLowCarbonEmission: false,
        isSameAirlines: false, isSameDepArrAirport: true, isTravelClub: false,
        minFare: {}, viaCount: [], selectedItineraries: [],
      },
      limit: 5, skip: 0, sort: { adultMinFare: 1 },
    },
    initialRequest: true,
  };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Referer': 'https://flight.naver.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://flight.naver.com',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    clearTimeout(timer);
    if (!res.ok) return null;

    const text = await res.text();
    const airlineMap: Record<string, string> = {};
    const itMap = new Map<string, { airlineCode: string }>();
    let bestPrice = Infinity;
    let bestAirlineCode = '';

    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.status?.airlinesCodeMap) Object.assign(airlineMap, data.status.airlinesCodeMap);
        for (const it of (data.itineraries ?? [])) {
          itMap.set(it.itineraryId, { airlineCode: it.segments?.[0]?.marketingCarrier?.airlineCode ?? '' });
        }
        for (const fm of (data.fareMappings ?? [])) {
          for (const fare of (fm.fares ?? [])) {
            const total: number = fare.adult?.totalFare;
            if (typeof total === 'number' && total < bestPrice) {
              bestPrice = total;
              const outId = (fm.itineraryIds as string)?.split('-')[0] ?? '';
              bestAirlineCode = itMap.get(outId)?.airlineCode ?? '';
            }
          }
        }
      } catch { /* skip malformed line */ }
    }

    if (!isFinite(bestPrice)) return null;
    return { price: bestPrice, airline: airlineMap[bestAirlineCode] ?? bestAirlineCode, airlineCode: bestAirlineCode, departDate, returnDate };
  } catch {
    return null;
  }
}

export async function fetchJapanRoutes(today: Date): Promise<FlightDeal[]> {
  const dates: [string, string][] = [
    [addDays(today, 14), addDays(today, 17)],
    [addDays(today, 30), addDays(today, 33)],
    [addDays(today, 45), addDays(today, 48)],
  ];

  // 모든 (노선 × 날짜) 조합을 병렬 검색
  const tasks = JAPAN_ROUTES.flatMap(([origin, dest]) =>
    dates.map(([dep, ret]) => ({ origin, dest, dep, ret }))
  );

  const results = await Promise.allSettled(
    tasks.map(({ origin, dest, dep, ret }) => searchRoute(origin, dest, dep, ret, true))
  );

  // 노선별 최저가 추출
  const bestByRoute = new Map<string, FlightDeal>();
  tasks.forEach(({ origin, dest }, i) => {
    const r = results[i];
    if (r.status !== 'fulfilled' || !r.value) return;
    const key = `${origin}_${dest}`;
    const cur = bestByRoute.get(key);
    if (!cur || r.value.price < cur.price) {
      bestByRoute.set(key, {
        routeId: key,
        routeName: routeName(origin, dest),
        departDate: r.value.departDate,
        returnDate: r.value.returnDate,
        nights: 3,
        price: r.value.price,
        airline: r.value.airline,
        direct: true,
        url: naverUrl(origin, dest, r.value.departDate, r.value.returnDate),
      });
    }
  });

  return Array.from(bestByRoute.values());
}

export async function fetchNzRoutes(): Promise<FlightDeal[]> {
  const results = await Promise.allSettled(
    NZ_TRIPS.map(({ departDate, returnDate }) =>
      searchRoute('ICN', 'AKL', departDate, returnDate, false)
    )
  );

  return NZ_TRIPS.flatMap(({ departDate, returnDate, nights }, i) => {
    const r = results[i];
    if (r.status !== 'fulfilled' || !r.value) return [];
    return [{
      routeId: 'ICN_AKL',
      routeName: routeName('ICN', 'AKL'),
      departDate,
      returnDate,
      nights,
      price: r.value.price,
      airline: r.value.airline,
      direct: false,
      url: naverUrl('ICN', 'AKL', departDate, returnDate).replace('isDirect=true', 'isDirect=false'),
    }];
  });
}
