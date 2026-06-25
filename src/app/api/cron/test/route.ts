import { NextResponse } from 'next/server';

export async function GET() {
  const body = {
    adultCount: 1, childCount: 0, infantCount: 0,
    device: 'pc', isNonstop: true,
    itineraries: [
      { departureLocationCode: 'ICN', departureLocationType: 'airport', arrivalLocationCode: 'FUK', arrivalLocationType: 'airport', departureDate: '20260709' },
      { departureLocationCode: 'FUK', departureLocationType: 'airport', arrivalLocationCode: 'ICN', arrivalLocationType: 'airport', departureDate: '20260712' },
    ],
    openReturnDays: 0, seatClass: 'Y', tripType: 'RT',
    flightFilter: {
      filter: {
        airlines: [], departureAirports: [['ICN'], ['FUK']], arrivalAirports: [['FUK'], ['ICN']],
        departureTime: [], fareTypes: [], flightDurationSeconds: [],
        hasCardBenefit: false, isIndividual: false, isLowCarbonEmission: false,
        isSameAirlines: false, isSameDepArrAirport: true, isTravelClub: false,
        minFare: {}, viaCount: [], selectedItineraries: [],
      },
      limit: 3, skip: 0, sort: { adultMinFare: 1 },
    },
    initialRequest: true,
  };

  try {
    const res = await fetch('https://flight-api.naver.com/flight/international/searchFlights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Referer': 'https://flight.naver.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://flight.naver.com',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    const status = res.status;
    const headers = Object.fromEntries(res.headers.entries());
    const text = await res.text();
    const preview = text.slice(0, 500);
    const lineCount = text.split('\n').filter(l => l.startsWith('data: ')).length;

    return NextResponse.json({ status, headers, lineCount, preview });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
