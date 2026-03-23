export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type PaymentMethod = 'MPESA' | 'CASH';

export interface Payment {
  id: string;
  rideId: string | null;
  parcelId: string | null;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  mpesaPhone: string | null;
  mpesaReceiptNumber: string | null;
  createdAt: string;
  completedAt: string | null;
}
