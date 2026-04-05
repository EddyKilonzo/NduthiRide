import { Component, inject, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { RideService }     from '../../../core/services/ride.service';
import { PaymentService }  from '../../../core/services/payment.service';
import { TrackingService, type TripPaymentPayload } from '../../../core/services/tracking.service';
import { ToastService }    from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { RoutePickerMapComponent, RouteMapPoint } from '../../../shared/components/route-picker-map/route-picker-map.component';
import type { Ride, RidePayment } from '../../../core/models/ride.models';

const ACTIVE_STATUSES: Ride['status'][] = [
  'ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PICKUP', 'IN_PROGRESS',
];

@Component({
  selector: 'app-ride-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule, RoutePickerMapComponent],
  template: `
    <div class="page app-page">
      @if (loading()) {
        <app-spinner [overlay]="true" />
      } @else if (!ride()) {
        <div class="empty-state"><h3>Ride not found</h3></div>
      } @else {
        <div class="page-header">
          <div>
            <h1>Ride Details</h1>
            <span class="badge badge--{{ badge(ride()!.status) }}">{{ ride()!.status }}</span>
          </div>
          <a [routerLink]="['/user/rides']" class="btn btn--ghost btn--sm">← Back</a>
        </div>

        <div class="detail-grid">
          @switch (paymentSuccessKind()) {
            @case ('mpesa-mid') {
              <div class="card card--payment-success-banner grid-full" role="status" aria-live="polite">
                <div class="payment-success-inner">
                  <lucide-icon name="check-circle" [size]="28" class="payment-success-icon"></lucide-icon>
                  <div>
                    <p class="payment-success-title">Payment successful</p>
                    <p class="payment-success-sub">M-Pesa payment received. Your fare is paid. When you reach your destination, your rider will complete the trip — then you can rate the experience.</p>
                  </div>
                </div>
              </div>
            }
            @case ('mpesa-done') {
              <div class="card card--payment-success-banner grid-full" role="status" aria-live="polite">
                <div class="payment-success-inner">
                  <lucide-icon name="party-popper" [size]="28" class="payment-success-icon"></lucide-icon>
                  <div>
                    <p class="payment-success-title">Payment successful</p>
                    <p class="payment-success-sub">Your M-Pesa payment is confirmed for this trip. Thank you for riding with NduthiRide.</p>
                  </div>
                </div>
              </div>
            }
            @case ('cash-done') {
              <div class="card card--payment-success-banner grid-full" role="status" aria-live="polite">
                <div class="payment-success-inner">
                  <lucide-icon name="check-circle" [size]="28" class="payment-success-icon"></lucide-icon>
                  <div>
                    <p class="payment-success-title">Trip &amp; payment recorded</p>
                    <p class="payment-success-sub">Your rider confirmed cash collection. This trip is closed — you can rate your experience below.</p>
                  </div>
                </div>
              </div>
            }
          }
          @if (showPassengerRatedBanner()) {
            <div class="card card--passenger-rated-banner grid-full">
              <div class="rated-banner-inner">
                <lucide-icon name="star" [size]="22" class="rated-banner-icon"></lucide-icon>
                <div>
                  <p class="rated-banner-title">Your rider rated you</p>
                  <p class="rated-banner-sub">They gave this trip <strong>{{ ride()!.passengerRating!.score }} / 5</strong> stars.</p>
                </div>
              </div>
            </div>
          }
          @if (showRatedThanks()) {
            <div class="card card--rated-banner grid-full">
              <div class="rated-banner-inner">
                <lucide-icon name="star" [size]="22" class="rated-banner-icon"></lucide-icon>
                <div>
                  <p class="rated-banner-title">Thanks for rating</p>
                  <p class="rated-banner-sub">You gave this ride <strong>{{ ride()!.rating!.score }} / 5</strong> stars.</p>
                </div>
              </div>
            </div>
          }
          @if (showRatingPrompt()) {
            <div class="card card--rating-prompt grid-full">
              <h3 class="rating-prompt-title">How was your ride?</h3>
              <p class="rating-prompt-sub">Trip complete — rate your rider. It helps everyone on NduthiRide.</p>
              <div class="stars" role="group" aria-label="Rating">
                @for (star of [1,2,3,4,5]; track star) {
                  <button type="button" class="star-btn" [class.star-btn--active]="selectedRating() >= star"
                    (click)="selectedRating.set(star)" [attr.aria-pressed]="selectedRating() >= star">
                    <lucide-icon name="star" [size]="28"></lucide-icon>
                  </button>
                }
              </div>
              <button class="btn btn--primary btn--full" [disabled]="selectedRating() === 0"
                (click)="submitRating()">Submit rating</button>
            </div>
          }

          <!-- Map card (Full width) — shows live rider dot when active -->
          <div class="card map-card grid-full">
            <div class="card-header-with-action">
              <h3 class="card-title">Route Map</h3>
              @if (isActive() && riderOnline()) {
                <span class="live-badge">
                  <span class="live-dot"></span> Live
                </span>
              }
            </div>
            <div class="map-container">
              <app-route-picker-map
                [pickup]="pickupPoint()"
                [dropoff]="dropoffPoint()"
                [riderPosition]="riderPosition()"
              />
            </div>
          </div>

          <!-- Route info card -->
          <div class="card">
            <h3 class="card-title">Addresses</h3>
            <div class="route-item">
              <div class="dot dot--pickup"></div>
              <div>
                <p class="route-label">Pickup</p>
                <p>{{ ride()!.pickupAddress }}</p>
              </div>
            </div>
            <div class="route-line"></div>
            <div class="route-item">
              <div class="dot dot--drop"></div>
              <div>
                <p class="route-label">Drop-off</p>
                <p>{{ ride()!.dropoffAddress }}</p>
              </div>
            </div>
          </div>

          <!-- Fare card -->
          <div class="card">
            <h3 class="card-title">Fare & Distance</h3>
            <div class="info-row">
              <span>Distance</span>
              <strong>{{ ride()!.distanceKm | number:'1.1-1' }} km</strong>
            </div>
            <div class="info-row">
              <span>Estimated</span>
              <strong>KES {{ ride()!.estimatedFare | number:'1.0-0' }}</strong>
            </div>
            @if (ride()!.finalFare) {
              <div class="info-row">
                <span>Final Fare</span>
                <strong class="text-primary">KES {{ ride()!.finalFare! | number:'1.0-0' }}</strong>
              </div>
            }
            <div class="info-row">
              <span>Payment method</span>
              <strong>{{ ride()!.paymentMethod === 'MPESA' ? 'M-Pesa' : 'Cash' }}</strong>
            </div>
            @if (ride()!.paymentMethod === 'MPESA') {
              <div class="info-row">
                <span>M-Pesa status</span>
                <strong class="fare-pay-line fare-pay-line--{{ farePaymentSummary().variant }}">{{ farePaymentSummary().text }}</strong>
              </div>
            } @else {
              <div class="info-row">
                <span>Settlement</span>
                @if (ride()!.status === 'COMPLETED' && ride()!.payment?.status === 'COMPLETED') {
                  <strong class="fare-pay-line fare-pay-line--success">Cash recorded ✓</strong>
                } @else {
                  <strong class="fare-pay-line fare-pay-line--muted">Cash — pay your driver directly</strong>
                }
              </div>
            }
          </div>

          <!-- Rider card -->
          @if (ride()!.rider) {
            <div class="card">
              <div class="card-header-with-action">
                <h3 class="card-title">Your Rider</h3>
                <a [routerLink]="['/user/chat/ride', ride()!.id]" class="btn btn--secondary btn--sm">
                  <lucide-icon name="message-square" [size]="14"></lucide-icon> Chat
                </a>
              </div>
              <div class="rider-info">
                <div class="avatar">{{ ride()!.rider!.account.fullName.charAt(0) }}</div>
                <div>
                  <p class="rider-name">{{ ride()!.rider!.account.fullName }}</p>
                  <p class="rider-sub">{{ ride()!.rider!.account.phone }}</p>
                  <p class="rider-sub rider-rating">
                    <lucide-icon name="star" [size]="14" class="star-inline"></lucide-icon>
                    {{ ride()!.rider!.ratingAverage | number:'1.1-1' }}
                  </p>
                  <p class="rider-sub">{{ ride()!.rider!.bikeModel }} — {{ ride()!.rider!.bikeRegistration }}</p>
                </div>
              </div>
            </div>
          }

          <!-- Payment card -->
          @if (ride()!.paymentMethod === 'MPESA') {
            <div class="card payment-card">
              <h3 class="card-title">Payment</h3>
              @if (payment(); as p) {
                <div class="payment-status payment-status--{{ p.status.toLowerCase() }}" [class.payment-status--success-pulse]="p.status === 'COMPLETED'">
                  <lucide-icon [name]="paymentIcon(p.status)" [size]="20"></lucide-icon>
                  <div>
                    <p class="payment-status-label">{{ paymentLabel(p.status) }}</p>
                    @if (p.mpesaReceiptNumber) {
                      <p class="payment-receipt">Receipt: {{ p.mpesaReceiptNumber }}</p>
                    }
                    @if (p.status === 'PROCESSING') {
                      <p class="payment-hint">Check your phone for the M-Pesa prompt. It may take up to 30 seconds to arrive.</p>
                    }
                  </div>
                </div>
                @if (p.status === 'FAILED' || (p.status === 'PROCESSING' && showResendOption())) {
                  <p class="payment-hint" style="margin-top:10px">
                    @if (p.status === 'FAILED') { The prompt was not completed. }
                    @else { Didn't get the prompt or it expired? }
                    You can resend below.
                  </p>
                  <button class="btn btn--secondary btn--full" style="margin-top:8px" (click)="resendPayment()" [disabled]="payingNow()">
                    @if (payingNow()) { <app-spinner [size]="16" /> Sending... }
                    @else { <lucide-icon name="rotate-cw" [size]="16"></lucide-icon> Resend M-Pesa Prompt }
                  </button>
                }
              } @else if (canPay()) {
                <p class="payment-hint">Pay via M-Pesa STK push to {{ ride()!.mpesaPhone }}.</p>
                <button class="btn btn--primary btn--full" (click)="initiatePayment()" [disabled]="payingNow()">
                  @if (payingNow()) { <app-spinner [size]="16" /> Sending prompt... }
                  @else { Pay KES {{ ride()!.estimatedFare | number:'1.0-0' }} via M-Pesa }
                </button>
              }
            </div>
          }

          <!-- Actions -->
          @if (['PENDING','ACCEPTED','EN_ROUTE_TO_PICKUP','ARRIVED_AT_PICKUP'].includes(ride()!.status)) {
            <div class="card actions-card">
              <h3 class="card-title">Actions</h3>
              <button class="btn btn--danger btn--full" (click)="cancel()" [disabled]="cancelling()">
                @if (cancelling()) { Cancelling... } @else { Cancel Ride }
              </button>
            </div>
          }

          <!-- Support action -->
          <div class="card support-box">
            <h3 class="card-title">Need Help?</h3>
            <p class="support-text">Having trouble with this ride? Our support team is here to help.</p>
            <a [routerLink]="['/user/support']" [queryParams]="{ subject: 'Issue with Ride ' + ride()!.id.slice(0,8) }" class="btn btn--secondary btn--full">
              <lucide-icon name="help-circle" [size]="18"></lucide-icon> Report an Issue
            </a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 20px; }
    .grid-full { grid-column: 1 / -1; }
    .card-title { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 16px; }
    .card-header-with-action { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-header-with-action .card-title { margin-bottom: 0; }
    .route-item { display: flex; align-items: flex-start; gap: 12px; }
    .route-line { width: 2px; height: 20px; background: var(--clr-border); margin: 4px 6px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .dot--pickup { background: #F59E0B; }
    .dot--drop   { background: #22C55E; }
    .route-label { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; }
    .info-row { display: flex; justify-content: space-between; font-size: 14px; padding: 10px 0; border-bottom: 1px solid var(--clr-border-subtle); color: var(--clr-text-muted); }
    .info-row:last-child { border: none; }
    .rider-info { display: flex; align-items: flex-start; gap: 12px; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--clr-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; color: #fff; }
    .rider-name { font-weight: 600; }
    .rider-sub  { font-size: 13px; color: var(--clr-text-muted); }
    .rider-rating { display: inline-flex; align-items: center; gap: 6px; }
    .star-inline { color: var(--clr-warning); flex-shrink: 0; }
    .detail-grid .card { 
      box-shadow: rgba(50, 50, 93, 0.25) 0px 50px 100px -20px, rgba(0, 0, 0, 0.3) 0px 30px 60px -30px, rgba(10, 37, 64, 0.35) 0px -2px 6px 0px inset;
      border: 1px solid var(--clr-border);
      padding: 20px;
    }
    .map-card { padding: 0 !important; overflow: hidden; height: 320px; }
    .map-container { height: 100%; width: 100%; }
    .stars { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
    .star-btn {
      padding: 4px; color: var(--clr-text-dim); cursor: pointer; transition: color var(--transition), transform 0.15s ease;
      border-radius: 8px;
    }
    .star-btn:hover { color: var(--clr-warning); transform: scale(1.06); }
    .star-btn--active { color: var(--clr-warning); }
    .support-box { background: rgba(var(--clr-primary-rgb), 0.03); border-style: dashed; }
    .support-text { font-size: 13px; color: var(--clr-text-muted); margin-bottom: 16px; }

    /* Live badge */
    .live-badge {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; color: var(--clr-success);
      background: rgba(34,197,94,0.12); padding: 4px 10px; border-radius: 20px;
    }
    .live-dot {
      width: 8px; height: 8px; background: var(--clr-success); border-radius: 50%;
      animation: pulse-dot 1.4s infinite;
    }
    @keyframes pulse-dot {
      0%,100% { opacity: 1; } 50% { opacity: 0.3; }
    }

    /* Payment card */
    .payment-hint { font-size: 13px; color: var(--clr-text-muted); margin-bottom: 14px; }
    .payment-status {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px; border-radius: var(--radius-md); margin-bottom: 4px;
      border: 1px solid var(--clr-border);
    }
    .payment-status--completed { background: rgba(34,197,94,0.08); border-color: rgba(34,197,94,0.25); color: var(--clr-success); }
    .payment-status--success-pulse {
      animation: payment-success-pulse 0.9s ease-out 1;
    }
    @keyframes payment-success-pulse {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45); transform: scale(1); }
      55% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); transform: scale(1.01); }
      100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); transform: scale(1); }
    }
    .payment-status--failed    { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.25);  color: var(--clr-error); }
    .payment-status--processing,.payment-status--pending {
      background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.25); color: var(--clr-warning);
    }
    .payment-status-label { font-weight: 700; font-size: 14px; }
    .payment-receipt { font-size: 12px; margin-top: 4px; opacity: 0.85; }

    .fare-pay-line--success { color: var(--clr-success); }
    .fare-pay-line--warning { color: var(--clr-warning); }
    .fare-pay-line--error   { color: var(--clr-error); }
    .fare-pay-line--neutral,
    .fare-pay-line--muted   { color: var(--clr-text-muted); }

    .card--rating-prompt {
      border: 2px solid rgba(var(--clr-primary-rgb), 0.35);
      background: linear-gradient(135deg, rgba(var(--clr-primary-rgb), 0.06) 0%, transparent 55%);
    }
    .rating-prompt-title { font-size: 1.25rem; font-weight: 700; margin: 0 0 8px; color: var(--clr-text); }
    .rating-prompt-sub { font-size: 14px; color: var(--clr-text-muted); margin: 0 0 18px; line-height: 1.45; }

    .card--payment-success-banner {
      background: rgba(34, 197, 94, 0.1);
      border: 2px solid rgba(34, 197, 94, 0.35);
    }
    .payment-success-inner { display: flex; align-items: flex-start; gap: 14px; }
    .payment-success-icon { color: var(--clr-success); flex-shrink: 0; margin-top: 2px; }
    .payment-success-title { font-weight: 800; margin: 0 0 6px; font-size: 16px; color: var(--clr-text); }
    .payment-success-sub { margin: 0; font-size: 14px; color: var(--clr-text-muted); line-height: 1.45; }

    .card--passenger-rated-banner {
      background: rgba(var(--clr-primary-rgb), 0.06);
      border-color: rgba(var(--clr-primary-rgb), 0.28);
    }
    .card--rated-banner {
      background: rgba(34, 197, 94, 0.08);
      border-color: rgba(34, 197, 94, 0.28);
    }
    .rated-banner-inner { display: flex; align-items: flex-start; gap: 14px; }
    .rated-banner-icon { color: var(--clr-warning); flex-shrink: 0; margin-top: 2px; }
    .rated-banner-title { font-weight: 700; margin: 0 0 4px; font-size: 15px; }
    .rated-banner-sub { margin: 0; font-size: 14px; color: var(--clr-text-muted); }

    @media (max-width: 640px) {
      .detail-grid { grid-template-columns: 1fr; }
      .map-card { height: 240px; }
    }
  `],
})
export class RideDetailComponent implements OnInit, OnDestroy {
  private readonly route           = inject(ActivatedRoute);
  private readonly rideService     = inject(RideService);
  private readonly paymentService  = inject(PaymentService);
  private readonly trackingService = inject(TrackingService);
  private readonly toast           = inject(ToastService);

  protected readonly ride           = signal<Ride | null>(null);
  protected readonly loading        = signal(true);
  protected readonly cancelling     = signal(false);
  protected readonly selectedRating = signal(0);

  // Payment
  protected readonly payment        = signal<RidePayment | null>(null);
  protected readonly payingNow      = signal(false);
  /** Becomes true after the 30-second grace window while STK push is in-flight. */
  protected readonly showResendOption = signal(false);
  private resendGraceTimer: ReturnType<typeof setTimeout> | null = null;

  // Live tracking
  protected readonly riderPosition = signal<RouteMapPoint | null>(null);
  protected readonly riderOnline   = signal(false);

  private subscribedPaymentId: string | null = null;
  private paymentUpdateCb: ((d: unknown) => void) | null = null;
  private locationCb: (() => void) | null = null;
  private tripPaymentListening = false;
  private paymentPollGeneration = 0;

  private readonly tripPaymentHandler = (d: TripPaymentPayload) => {
    const r = this.ride();
    if (!r || d.kind !== 'ride' || d.entityId !== r.id) return;
    if (d.status !== 'COMPLETED' && d.status !== 'FAILED') return;
    this.applyPaymentTerminal(
      d.status,
      d.mpesaReceiptNumber,
      d.completedAt ?? null,
    );
    if (d.status === 'COMPLETED') {
      void this.rideService.getById(r.id).then((fresh) => {
        this.ride.set(fresh);
        if (fresh.payment) this.payment.set(fresh.payment as RidePayment);
      });
    }
  };

  protected readonly pickupPoint = computed<RouteMapPoint | null>(() => {
    const r = this.ride();
    return r ? { lat: r.pickupLat, lng: r.pickupLng } : null;
  });

  protected readonly dropoffPoint = computed<RouteMapPoint | null>(() => {
    const r = this.ride();
    return r ? { lat: r.dropoffLat, lng: r.dropoffLng } : null;
  });

  protected readonly isActive = computed(() =>
    ACTIVE_STATUSES.includes(this.ride()?.status as Ride['status']),
  );

  protected readonly canPay = computed(() => {
    const r = this.ride();
    return r?.paymentMethod === 'MPESA' && !this.payment()
      && ACTIVE_STATUSES.includes(r.status as Ride['status']);
  });

  /**
   * High-visibility success banners: in-trip M-Pesa, completed trip M-Pesa, or cash settled after rider completes.
   */
  protected readonly paymentSuccessKind = computed(():
    | 'mpesa-mid'
    | 'mpesa-done'
    | 'cash-done'
    | null => {
    const r = this.ride();
    if (!r) return null;
    const p = this.payment();
    if (r.paymentMethod === 'MPESA' && p?.status === 'COMPLETED') {
      if (ACTIVE_STATUSES.includes(r.status as Ride['status'])) return 'mpesa-mid';
      if (r.status === 'COMPLETED') return 'mpesa-done';
    }
    if (
      r.paymentMethod === 'CASH' &&
      r.status === 'COMPLETED' &&
      r.payment?.status === 'COMPLETED'
    ) {
      return 'cash-done';
    }
    return null;
  });

  protected readonly showPassengerRatedBanner = computed(() => {
    const r = this.ride();
    return r?.status === 'COMPLETED' && !!r.passengerRating;
  });

  protected readonly showRatingPrompt = computed(() => {
    const r = this.ride();
    return r?.status === 'COMPLETED' && !r.rating;
  });

  protected readonly showRatedThanks = computed(() => {
    const r = this.ride();
    return r?.status === 'COMPLETED' && !!r.rating;
  });

  protected readonly farePaymentSummary = computed((): {
    text: string;
    variant: 'success' | 'warning' | 'error' | 'neutral' | 'muted';
  } => {
    const r = this.ride();
    const p = this.payment();
    if (!r || r.paymentMethod !== 'MPESA') {
      return { text: '', variant: 'neutral' };
    }
    if (!p) {
      if (ACTIVE_STATUSES.includes(r.status as Ride['status'])) {
        return { text: 'Pay below before the ride ends', variant: 'warning' };
      }
      if (r.status === 'COMPLETED') {
        return { text: 'No M-Pesa record on file', variant: 'neutral' };
      }
      return { text: 'Not started', variant: 'neutral' };
    }
    switch (p.status) {
      case 'COMPLETED':
        return { text: 'Paid ✓', variant: 'success' };
      case 'FAILED':
        return { text: 'Failed — resend below', variant: 'error' };
      case 'PROCESSING':
        return { text: 'Awaiting M-Pesa…', variant: 'warning' };
      default:
        return { text: 'Pending', variant: 'warning' };
    }
  });

  constructor() {
    // Mirror TrackingService riderLocation signal → local riderPosition
    effect(() => {
      const loc = this.trackingService.riderLocation();
      if (loc) {
        this.riderPosition.set({ lat: loc.lat, lng: loc.lng });
        this.riderOnline.set(true);
      }
    });
  }

  /** Start 30-second grace period before revealing the Resend button. */
  private startResendGrace(): void {
    this.clearResendGrace();
    this.showResendOption.set(false);
    this.resendGraceTimer = setTimeout(() => this.showResendOption.set(true), 30_000);
  }

  private clearResendGrace(): void {
    if (this.resendGraceTimer !== null) {
      clearTimeout(this.resendGraceTimer);
      this.resendGraceTimer = null;
    }
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    void this.rideService.getById(id).then((r) => {
      this.ride.set(r);
      if (r.payment) {
        this.payment.set(r.payment as RidePayment);
        // Payment was already in PROCESSING when we arrived — show resend immediately.
        if ((r.payment as RidePayment).status === 'PROCESSING') {
          this.showResendOption.set(true);
        }
      }
      this.loading.set(false);

      // Start live tracking for active rides
      if (ACTIVE_STATUSES.includes(r.status as Ride['status'])) {
        this.trackingService.connect();
        this.trackingService.watchRiderLocation();
      }

      // Subscribe to existing payment WebSocket room
      if (r.payment?.checkoutRequestId && r.payment.status === 'PROCESSING') {
        this.subscribePaymentSocket(r.payment.id);
        void this.startPaymentPollFallback(r.payment.checkoutRequestId);
      }

      if (r.paymentMethod === 'MPESA') {
        this.trackingService.connect();
        if (!this.tripPaymentListening) {
          this.trackingService.onTripPayment(this.tripPaymentHandler);
          this.tripPaymentListening = true;
        }
      }
    }).catch(() => this.loading.set(false));
  }

  ngOnDestroy(): void {
    this.clearResendGrace();
    if (this.subscribedPaymentId) {
      this.trackingService.unsubscribeFromPayment(this.subscribedPaymentId);
    }
    if (this.paymentUpdateCb) {
      this.trackingService.offPaymentUpdate(this.paymentUpdateCb as (d: unknown) => void);
    }
    if (this.tripPaymentListening) {
      this.trackingService.offTripPayment(this.tripPaymentHandler);
    }
    // Disconnect tracking if we connected it
    if (this.isActive()) {
      this.trackingService.disconnect();
    }
  }

  protected async initiatePayment(): Promise<void> {
    const r = this.ride();
    if (!r || !r.mpesaPhone) return;
    this.payingNow.set(true);
    try {
      const result = await this.paymentService.initiateForRide(r.id, r.mpesaPhone, 'MPESA');
      this.payment.set({
        id: result.paymentId,
        status: 'PROCESSING',
        amount: r.estimatedFare,
        method: 'MPESA',
        mpesaReceiptNumber: null,
        completedAt: null,
        checkoutRequestId: result.checkoutRequestId ?? null,
      });
      this.toast.info('Check your phone for the M-Pesa prompt.');
      this.startResendGrace();
      this.trackingService.connect();
      this.subscribePaymentSocket(result.paymentId);
      if (result.checkoutRequestId) {
        void this.startPaymentPollFallback(result.checkoutRequestId);
      }
    } catch {
      this.toast.error('Could not initiate payment. Try again.');
    } finally {
      this.payingNow.set(false);
    }
  }

  protected async resendPayment(): Promise<void> {
    const p = this.payment();
    const r = this.ride();
    if (!p || !r) return;
    this.payingNow.set(true);
    try {
      // Clean up the old socket room before subscribing to the new payment
      if (this.subscribedPaymentId) {
        this.trackingService.unsubscribeFromPayment(this.subscribedPaymentId);
        this.subscribedPaymentId = null;
      }
      if (this.paymentUpdateCb) {
        this.trackingService.offPaymentUpdate(this.paymentUpdateCb as (d: unknown) => void);
        this.paymentUpdateCb = null;
      }

      const result = await this.paymentService.resend(p.id);
      this.payment.set({
        id: result.paymentId,
        status: 'PROCESSING',
        amount: r.estimatedFare,
        method: 'MPESA',
        mpesaReceiptNumber: null,
        completedAt: null,
        checkoutRequestId: result.checkoutRequestId ?? null,
      });
      this.toast.info('Check your phone for the M-Pesa prompt.');
      this.startResendGrace();
      this.trackingService.connect();
      this.subscribePaymentSocket(result.paymentId);
      if (result.checkoutRequestId) {
        void this.startPaymentPollFallback(result.checkoutRequestId);
      }
    } catch {
      this.toast.error('Could not resend payment prompt. Try again.');
    } finally {
      this.payingNow.set(false);
    }
  }

  /** When webhook/socket is slow, polling still updates payment + refreshes ride. */
  private async startPaymentPollFallback(checkoutRequestId: string): Promise<void> {
    const gen = ++this.paymentPollGeneration;
    try {
      const res = await this.paymentService.pollStatus(checkoutRequestId);
      if (gen !== this.paymentPollGeneration) return;
      if (res.status === 'COMPLETED' || res.status === 'FAILED') {
        this.applyPaymentTerminal(res.status, res.mpesaReceiptNumber, null);
      }
    } catch {
      /* timeout or network — user can refresh */
    }
  }

  private applyPaymentTerminal(
    status: string,
    mpesaReceiptNumber: string | null | undefined,
    completedAt: string | null | undefined,
  ): void {
    const prev = this.payment()?.status;
    this.payment.update((p) =>
      p
        ? {
            ...p,
            status: status as RidePayment['status'],
            mpesaReceiptNumber: mpesaReceiptNumber ?? p.mpesaReceiptNumber,
            completedAt: completedAt ?? p.completedAt,
          }
        : p,
    );
    if (status === 'COMPLETED' && prev !== 'COMPLETED') {
      this.clearResendGrace();
      this.showResendOption.set(false);
      this.toast.success('Payment successful — your fare is paid.');
      const rid = this.ride()?.id;
      if (rid) {
        void this.rideService.getById(rid).then((fresh) => {
          this.ride.set(fresh);
          if (fresh.payment) this.payment.set(fresh.payment as RidePayment);
        });
      }
    }
    if (status === 'FAILED' && prev !== 'FAILED') {
      this.clearResendGrace();
      this.showResendOption.set(true);
      this.toast.error('Payment was not completed. You can resend the M-Pesa prompt.');
    }
  }

  private subscribePaymentSocket(paymentId: string): void {
    this.subscribedPaymentId = paymentId;
    this.trackingService.subscribeToPayment(paymentId);

    this.paymentUpdateCb = (data: unknown) => {
      const d = data as { status: string; mpesaReceiptNumber?: string | null; completedAt?: string };
      if (d.status === 'COMPLETED' || d.status === 'FAILED') {
        this.applyPaymentTerminal(d.status, d.mpesaReceiptNumber, d.completedAt ?? null);
      } else {
        this.payment.update((p) =>
          p
            ? {
                ...p,
                status: d.status as RidePayment['status'],
                mpesaReceiptNumber: d.mpesaReceiptNumber ?? p.mpesaReceiptNumber,
                completedAt: d.completedAt ?? p.completedAt,
              }
            : p,
        );
      }
    };
    this.trackingService.onPaymentUpdate(this.paymentUpdateCb as (d: { status: string; amount?: number; mpesaReceiptNumber?: string | null; completedAt?: string }) => void);
  }

  protected cancel(): void {
    const id = this.ride()?.id;
    if (!id) return;
    this.cancelling.set(true);
    void this.rideService.cancel(id).then((r) => {
      this.ride.set(r);
      this.cancelling.set(false);
      this.toast.success('Ride cancelled');
    }).catch(() => {
      this.toast.error('Could not cancel');
      this.cancelling.set(false);
    });
  }

  protected submitRating(): void {
    const id = this.ride()?.id;
    if (!id || this.selectedRating() === 0) return;
    const score = this.selectedRating();
    void this.rideService
      .rate(id, score)
      .then(async () => {
        this.selectedRating.set(0);
        const fresh = await this.rideService.getById(id);
        this.ride.set(fresh);
        if (fresh.payment) this.payment.set(fresh.payment as RidePayment);
        this.toast.success('Thank you for your feedback!');
      })
      .catch(() => this.toast.error('Rating failed'));
  }

  protected badge(status: string): string {
    const map: Record<string, string> = { PENDING: 'pending', COMPLETED: 'active', CANCELLED: 'closed' };
    return map[status] ?? 'info';
  }

  protected paymentIcon(status: string): string {
    const icons: Record<string, string> = { COMPLETED: 'check-circle', FAILED: 'x-circle', PROCESSING: 'loader', PENDING: 'clock' };
    return icons[status] ?? 'credit-card';
  }

  protected paymentLabel(status: string): string {
    const labels: Record<string, string> = { COMPLETED: 'Payment confirmed', FAILED: 'Payment failed', PROCESSING: 'Awaiting M-Pesa confirmation', PENDING: 'Payment pending' };
    return labels[status] ?? status;
  }
}
