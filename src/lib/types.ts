export interface FlightDeal {
  routeId: string;
  routeName: string;
  departDate: string;
  returnDate: string;
  nights: number;
  price: number;
  airline: string;
  direct: boolean;
  durationMinutes: number; // 가는 편 비행 시간(분)
  url: string;
}

export interface CalendarEvent {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (inclusive)
  type?: 'personal' | 'public'; // 없으면(과거 데이터) personal로 취급
}

export interface DashboardData {
  updatedAt: string;
  japanDeals: FlightDeal[];
  japanAllRoutes?: FlightDeal[];
  sydneyFlights: FlightDeal[];
  calendarEvents?: CalendarEvent[]; // Google Calendar 휴가 일정
}

export interface PriceRecord {
  date: string;       // YYYY-MM-DD
  price: number;
  departDate: string;
}

export interface RouteHistory {
  routeId: string;
  routeName: string;
  records: PriceRecord[];
}

export type FlightHistory = { [routeId: string]: RouteHistory };
