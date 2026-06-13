export interface FlightDeal {
  routeId: string;
  routeName: string;
  departDate: string;
  returnDate: string;
  nights: number;
  price: number;
  airline: string;
  direct: boolean;
  url: string;
}

export interface CalendarEvent {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD (inclusive)
}

export interface DashboardData {
  updatedAt: string;
  searchDates: { plus14: string; plus30: string; plus45: string };
  japanDeals: FlightDeal[];
  japanAllRoutes?: FlightDeal[];
  vacationSearch: { period: string; flights: FlightDeal[] } | null;
  nzFlights: FlightDeal[];
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
