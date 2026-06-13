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

export interface DashboardData {
  updatedAt: string;
  searchDates: { plus14: string; plus30: string; plus45: string };
  japanDeals: FlightDeal[];
  japanAllRoutes?: FlightDeal[]; // 전체 노선 최저가 (추이 추적용)
  vacationSearch: { period: string; flights: FlightDeal[] } | null;
  nzFlights: FlightDeal[];
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
