import { Injectable, OnDestroy, signal, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface RiderLocation {
  riderId: string;
  lat: number;
  lng: number;
  speed: number | null;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class TrackingService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;

  readonly riderLocation = signal<RiderLocation | null>(null);
  readonly riderOnline   = signal<boolean>(false);

  // ─── Shared connection ───────────────────────────────────────────

  connect(): void {
    try {
      if (this.socket?.connected) return;

      this.socket = io(`${environment.wsUrl}/tracking`, {
        auth: { token: this.auth.getAccessToken() ?? '' },
        transports: ['websocket'],
      });

      this.socket.on('connect_error', (err) => {
        console.error('Tracking socket connection error:', err);
      });
    } catch (error) {
      console.error('Failed to initialize tracking socket:', error);
    }
  }

  disconnect(): void {
    try {
      this.socket?.disconnect();
      this.socket = null;
    } catch (error) {
      console.error('Error during tracking socket disconnect:', error);
    }
  }

  // ─── User side — receive rider location ─────────────────────────

  watchRiderLocation(): void {
    try {
      this.socket?.on('tracking:location', (payload: RiderLocation) => {
        this.riderLocation.set(payload);
        this.riderOnline.set(true);
      });
    } catch (error) {
      console.error('Error setting up location watcher:', error);
    }
  }

  // ─── Rider side — send location updates ─────────────────────────

  sendLocation(lat: number, lng: number, speed?: number): void {
    try {
      this.socket?.emit('rider:location-update', { lat, lng, speed });
    } catch (error) {
      console.error('Failed to send location update:', error);
    }
  }

  toggleAvailability(isAvailable: boolean): void {
    try {
      this.socket?.emit('rider:toggle-availability', { isAvailable });
    } catch (error) {
      console.error('Failed to toggle availability:', error);
    }
  }

  // ─── New ride / parcel request notifications ─────────────────────

  onNewRideRequest(cb: (payload: unknown) => void): void {
    this.socket?.on('ride:new-request', cb);
  }

  onNewParcelRequest(cb: (payload: unknown) => void): void {
    this.socket?.on('parcel:new-request', cb);
  }

  offNewRideRequest(cb: (payload: unknown) => void): void {
    this.socket?.off('ride:new-request', cb);
  }

  offNewParcelRequest(cb: (payload: unknown) => void): void {
    this.socket?.off('parcel:new-request', cb);
  }

  // ─── Payment status updates ──────────────────────────────────

  subscribeToPayment(paymentId: string): void {
    this.socket?.emit('payment:subscribe', { paymentId });
  }

  unsubscribeFromPayment(paymentId: string): void {
    this.socket?.emit('payment:unsubscribe', { paymentId });
  }

  onPaymentUpdate(cb: (data: {
    status: string;
    amount?: number;
    mpesaReceiptNumber?: string | null;
    completedAt?: string;
  }) => void): void {
    this.socket?.on('payment:updated', cb);
  }

  offPaymentUpdate(cb: (data: unknown) => void): void {
    this.socket?.off('payment:updated', cb);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
