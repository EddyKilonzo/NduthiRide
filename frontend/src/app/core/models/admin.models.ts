export interface DashboardStats {
  totalUsers: number;
  totalRiders: number;
  totalRides: number;
  totalParcels: number;
  totalRevenue: number;
  activeRides: number;
  pendingRiders: number;
  todayRides: number;
  todayRevenue: number;
  completionRate: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
