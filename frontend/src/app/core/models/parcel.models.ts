import type { AuthUser } from './auth.models';
import type { PaymentMethod, RiderSummary } from './ride.models';

export type ParcelStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Parcel {
  id: string;
  userId: string;
  user: Pick<AuthUser, 'fullName' | 'phone' | 'avatarUrl'>;
  riderId: string | null;
  rider: RiderSummary | null;
  itemDescription: string;
  weightKg: number;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  recipientName: string;
  recipientPhone: string;
  status: ParcelStatus;
  deliveryFee: number;
  distanceKm: number;
  proofImageUrl: string | null;
  paymentMethod: PaymentMethod;
  mpesaPhone: string | null;
  createdAt: string;
  deliveredAt: string | null;
}

export interface CreateParcelDto {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  itemDescription: string;
  weightKg: number;
  recipientName: string;
  recipientPhone: string;
  paymentMethod: PaymentMethod;
  mpesaPhone?: string;
}
