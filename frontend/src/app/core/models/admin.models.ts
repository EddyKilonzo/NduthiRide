/** Shape returned by GET /admin/stats (see backend AdminService.getDashboardStats). */
export interface DashboardStats {
  totalUsers: number;
  totalRiders: number;
  totalRides: number;
  totalParcels: number;
  totalRevenue: number;
  activeRides: number;
  suspiciousCount?: number;
  verifiedRiders?: number;
  availableRiders?: number;
  completedRides?: number;
  completedParcels?: number;
  /** Optional legacy fields if API is extended */
  pendingRiders?: number;
  todayRides?: number;
  todayRevenue?: number;
  completionRate?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
