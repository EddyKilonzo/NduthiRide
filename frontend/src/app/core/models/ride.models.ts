import type { AuthUser } from './auth.models';

export type RideStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'EN_ROUTE_TO_PICKUP'
  | 'ARRIVED_AT_PICKUP'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentMethod = 'MPESA' | 'CASH';

export interface RiderSummary {
  id: string;
  accountId: string;
  account: { fullName: string; phone: string; avatarUrl: string | null };
  bikeRegistration: string;
  bikeModel: string | null;
  ratingAverage: number;
  currentLat: number | null;
  currentLng: number | null;
}

export interface Ride {
  id: string;
  userId: string;
  user: Pick<AuthUser, 'fullName' | 'phone' | 'avatarUrl'>;
  riderId: string | null;
  rider: RiderSummary | null;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  status: RideStatus;
  estimatedFare: number;
  finalFare: number | null;
  distanceKm: number;
  estimatedMins: number;
  paymentMethod: PaymentMethod;
  mpesaPhone: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateRideDto {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  paymentMethod: PaymentMethod;
  mpesaPhone?: string;
}

export interface FareEstimate {
  distanceKm: number;
  estimatedMins: number;
  estimatedFare: number;
}
