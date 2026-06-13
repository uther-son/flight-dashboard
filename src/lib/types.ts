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
  vacationSearch: { period: string; flights: FlightDeal[] } | null;
  nzFlights: FlightDeal[];
}
