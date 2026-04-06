import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ParcelService } from '../../../core/services/parcel.service';
import { PaymentService } from '../../../core/services/payment.service';
import { TrackingService, type TripPaymentPayload } from '../../../core/services/tracking.service';
import { ToastService }  from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Parcel, ParcelStatus } from '../../../core/models/parcel.models';
import type { RidePayment } from '../../../core/models/ride.models';

const ACTIVE_PARCEL_PAYMENT_STATUSES: ParcelStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
];

@Component({
  selector: 'app-parcel-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SpinnerComponent, LucideAngularModule],
  template: `
    @if (showPaymentSuccessOverlay()) {
      <div class="pay-overlay" (click)="dismissPaymentOverlay()" role="dialog" aria-modal="true" aria-label="Payment confirmed">
        <div class="confetti-wrap" aria-hidden="true">
          @for (i of confettiItems; track i) {
            <span class="confetti-piece" [style.--ci]="i"></span>
          }
        </div>
        <div class="pay-overlay-card" (click)="$event.stopPropagation()">
          <div class="check-wrap">
            <svg class="check-svg" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle class="check-circle" cx="40" cy="40" r="36" stroke="#22C55E" stroke-width="5" fill="none"/>
              <polyline class="check-mark" points="24,42 35,53 56,30" stroke="#22C55E" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </div>
          <h2 class="pay-overlay-title">Payment Confirmed!</h2>
          @if (paymentSuccessAmount()) {
            <p class="pay-overlay-amount">KES {{ paymentSuccessAmount()! | number:'1.0-0' }}</p>
          }
          @if (paymentSuccessReceipt()) {
            <p class="pay-overlay-receipt">{{ paymentSuccessReceipt() }}</p>
          }
          <p class="pay-overlay-hint">Tap anywhere to continue</p>
        </div>
      </div>
    }
    <div class="page app-page">
      @if (loading()) {
        <app-spinner [overlay]="true" />
      } @else if (!parcel()) {
        <div class="empty-state"><h3>Parcel not found</h3></div>
      } @else {
        <div class="page-header">
          <div>
            <h1>Parcel Details</h1>
            <span class="badge badge--{{ badge(parcel()!.status) }}">{{ parcel()!.status }}</span>
          </div>
          <a [routerLink]="['/user/parcels']" class="btn btn--ghost btn--sm"><lucide-icon name="arrow-left" [size]="16"></lucide-icon> Back</a>
        </div>

        <div class="detail-grid">
          @switch (paymentSuccessKind()) {
            @case ('mpesa-mid') {
              <div class="card card--payment-success-banner grid-full" role="status" aria-live="polite">
                <div class="payment-success-inner">
                  <lucide-icon name="check-circle" [size]="28" class="payment-success-icon"></lucide-icon>
                  <div>
                    <p class="payment-success-title">Payment successful</p>
                    <p class="payment-success-sub">M-Pesa payment received. Your delivery fee is paid. The rider will mark the parcel delivered once it arrives — then you can rate the experience.</p>
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
                    <p class="payment-success-sub">Your M-Pesa payment is confirmed for this delivery. Thank you for using NduthiRide.</p>
                  </div>
                </div>
              </div>
            }
            @case ('cash-done') {
              <div class="card card--payment-success-banner grid-full" role="status" aria-live="polite">
                <div class="payment-success-inner">
                  <lucide-icon name="check-circle" [size]="28" class="payment-success-icon"></lucide-icon>
                  <div>
                    <p class="payment-success-title">Delivery &amp; payment recorded</p>
                    <p class="payment-success-sub">Your rider confirmed cash collection. This delivery is closed — you can rate your experience below.</p>
                  </div>
                </div>
              </div>
            }
          }
          @if (showRatedThanks()) {
            <div class="card card--rated-banner grid-full">
              <div class="rated-banner-inner">
                <lucide-icon name="star" [size]="22" class="rated-banner-icon"></lucide-icon>
                <div>
                  <p class="rated-banner-title">Thanks for rating</p>
                  <p class="rated-banner-sub">You gave this delivery <strong>{{ parcel()!.rating!.score }} / 5</strong> stars.</p>
                </div>
              </div>
            </div>
          }
          @if (showRatingPrompt()) {
            <div class="card card--rating-prompt grid-full rating-prompt-animate">
              <div class="rating-header">
                <lucide-icon name="package" [size]="36" class="rating-icon"></lucide-icon>
                <div>
                  <h3 class="rating-prompt-title">How was your delivery?</h3>
                  <p class="rating-prompt-sub">Your parcel was delivered — rate your rider. It helps everyone on NduthiRide.</p>
                </div>
              </div>
              <div class="stars" role="group" aria-label="Star rating">
                @for (star of [1,2,3,4,5]; track star) {
                  <button type="button" class="star-btn"
                    [class.star-btn--active]="selectedRating() >= star"
                    [class.star-btn--hover]="hoverRating() >= star"
                    (mouseenter)="hoverRating.set(star)"
                    (mouseleave)="hoverRating.set(0)"
                    (click)="selectedRating.set(star)"
                    [attr.aria-pressed]="selectedRating() >= star"
                    [attr.aria-label]="star + ' star' + (star > 1 ? 's' : '')">
                    <lucide-icon name="star" [size]="34"></lucide-icon>
                  </button>
                }
              </div>
              @if (selectedRating() > 0) {
                <p class="rating-label">{{ ratingLabel() }}</p>
              }
              <textarea class="review-textarea" rows="3"
                placeholder="Leave a comment (optional)"
                [(ngModel)]="reviewCommentValue"
                maxlength="300">
              </textarea>
              <button class="btn btn--primary btn--full"
                [disabled]="selectedRating() === 0 || submittingRating()"
                (click)="submitRating()">
                @if (submittingRating()) { <app-spinner [size]="16" /> Submitting... }
                @else { Submit Rating }
              </button>
            </div>
          }

          <!-- Route card -->
          <div class="card">
            <h3 class="card-title">Route</h3>
            <div class="route-item">
              <div class="dot dot--pickup"></div>
              <div>
                <p class="route-label">Pickup</p>
                <p>{{ parcel()!.pickupAddress }}</p>
              </div>
            </div>
            <div class="route-line"></div>
            <div class="route-item">
              <div class="dot dot--drop"></div>
              <div>
                <p class="route-label">Drop-off</p>
                <p>{{ parcel()!.dropoffAddress }}</p>
              </div>
            </div>
          </div>

          <!-- Item card -->
          <div class="card">
            <h3 class="card-title">Item Details</h3>
            <div class="info-row"><span>Description</span><strong>{{ parcel()!.itemDescription }}</strong></div>
            <div class="info-row"><span>Weight</span><strong>{{ parcel()!.weightKg }} kg</strong></div>
            <div class="info-row"><span>Distance</span><strong>{{ parcel()!.distanceKm | number:'1.1-1' }} km</strong></div>
            <div class="info-row"><span>Delivery Fee</span><strong class="text-primary">KES {{ parcel()!.deliveryFee | number:'1.0-0' }}</strong></div>
            <div class="info-row"><span>Payment method</span><strong>{{ parcel()!.paymentMethod === 'MPESA' ? 'M-Pesa' : 'Cash' }}</strong></div>
            @if (parcel()!.paymentMethod === 'MPESA') {
              <div class="info-row">
                <span>M-Pesa status</span>
                <strong class="fare-pay-line fare-pay-line--{{ parcelPaymentSummary().variant }}">{{ parcelPaymentSummary().text }}</strong>
              </div>
            } @else {
              <div class="info-row">
                <span>Settlement</span>
                @if (parcel()!.status === 'DELIVERED' && parcel()!.payment?.status === 'COMPLETED') {
                  <strong class="fare-pay-line fare-pay-line--success">Cash recorded ✓</strong>
                } @else {
                  <strong class="fare-pay-line fare-pay-line--muted">Cash — pay your driver directly</strong>
                }
              </div>
            }
          </div>

          <!-- Recipient card -->
          <div class="card">
            <h3 class="card-title">Recipient</h3>
            <div class="info-row"><span>Name</span><strong>{{ parcel()!.recipientName }}</strong></div>
            <div class="info-row"><span>Phone</span><strong>{{ parcel()!.recipientPhone }}</strong></div>
            @if (parcel()!.deliveredAt) {
              <div class="info-row"><span>Delivered</span><strong>{{ parcel()!.deliveredAt | date:'dd MMM yyyy, HH:mm' }}</strong></div>
            }
          </div>

          <!-- Rider card -->
          @if (parcel()!.rider) {
            <div class="card">
              <div class="card-header-with-action">
                <h3 class="card-title">Your Rider</h3>
                <a [routerLink]="['/user/chat/parcel', parcel()!.id]" class="btn btn--secondary btn--sm">
                  <lucide-icon name="message-square" [size]="14"></lucide-icon> Chat
                </a>
              </div>
              <div class="rider-info">
                <div class="avatar">{{ parcel()!.rider!.account.fullName.charAt(0) }}</div>
                <div>
                  <p class="rider-name">{{ parcel()!.rider!.account.fullName }}</p>
                  <p class="rider-sub">{{ parcel()!.rider!.account.phone }}</p>
                  <p class="rider-sub rider-rating">
                    <lucide-icon name="star" [size]="14" class="star-inline"></lucide-icon>
                    {{ parcel()!.rider!.ratingAverage | number:'1.1-1' }}
                  </p>
                  <p class="rider-sub">{{ parcel()!.rider!.bikeModel }} — {{ parcel()!.rider!.bikeRegistration }}</p>
                </div>
              </div>
            </div>
          }

          <!-- Proof of delivery -->
          @if (parcel()!.proofImageUrl) {
            <div class="card">
              <h3 class="card-title">Proof of Delivery</h3>
              <img [src]="parcel()!.proofImageUrl!" alt="Delivery proof" class="proof-img" />
            </div>
          }

          <!-- Payment card -->
          @if (parcel()!.paymentMethod === 'MPESA') {
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
                @if (p.status === 'COMPLETED') {
                  <button
                    type="button"
                    class="btn btn--primary btn--full receipt-download-btn"
                    style="margin-top:12px"
                    (click)="downloadPaymentReceipt(p.id)"
                    [disabled]="receiptDownloading()">
                    @if (receiptDownloading()) {
                      <app-spinner [size]="16" />
                      Preparing PDF…
                    } @else {
                      <lucide-icon name="download" [size]="16"></lucide-icon>
                      Download PDF receipt
                    }
                  </button>
                }
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
                <p class="payment-hint">Pay via M-Pesa STK push to {{ parcel()!.mpesaPhone }}.</p>
                <button class="btn btn--primary btn--full" (click)="initiatePayment()" [disabled]="payingNow()">
                  @if (payingNow()) { <app-spinner [size]="16" /> Sending prompt... }
                  @else { Pay KES {{ parcel()!.deliveryFee | number:'1.0-0' }} via M-Pesa }
                </button>
              }
            </div>
          }

          <!-- Cancel action -->
          @if (['PENDING', 'ACCEPTED'].includes(parcel()!.status)) {
            <div class="card actions-card">
              <h3 class="card-title">Actions</h3>
              <button class="btn btn--danger btn--full" (click)="cancel()" [disabled]="cancelling()">
                @if (cancelling()) { Cancelling... } @else { Cancel Delivery }
              </button>
            </div>
          }

          <!-- Support action -->
          <div class="card support-box">
            <h3 class="card-title">Need Help?</h3>
            <p class="support-text">Having trouble with this delivery? Our support team is here to help.</p>
            <a [routerLink]="['/user/support']" [queryParams]="{ subject: 'Issue with Parcel ' + parcel()!.id.slice(0,8) }" class="btn btn--secondary btn--full">
              <lucide-icon name="help-circle" [size]="18"></lucide-icon> Report an Issue
            </a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .detail-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 16px; }
    .grid-full { grid-column: 1 / -1; }
    .card-title { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 16px; }
    .card-header-with-action { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .card-header-with-action .card-title { margin-bottom: 0; }
    .route-item { display: flex; align-items: flex-start; gap: 12px; }
    .route-line { width: 2px; height: 20px; background: var(--clr-border); margin: 4px 6px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .dot--pickup { background: var(--clr-primary); }
    .dot--drop   { background: var(--clr-success); }
    .route-label { font-size: 11px; color: var(--clr-text-muted); text-transform: uppercase; }
    .info-row { display: flex; justify-content: space-between; font-size: 14px; padding: 8px 0; border-bottom: 1px solid var(--clr-border); color: var(--clr-text-muted); }
    .info-row:last-child { border: none; }
    .rider-info { display: flex; align-items: flex-start; gap: 12px; }
    .avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--clr-primary); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px; flex-shrink: 0; }
    .rider-name { font-weight: 600; }
    .rider-sub  { font-size: 13px; color: var(--clr-text-muted); }
    .rider-rating { display: inline-flex; align-items: center; gap: 6px; }
    .star-inline { color: var(--clr-warning); flex-shrink: 0; }
    .detail-grid .card { box-shadow: var(--shadow-card); }
    .proof-img  { width: 100%; border-radius: var(--radius-md); max-height: 300px; object-fit: cover; }
    .stars { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
    .star-btn {
      padding: 4px; color: var(--clr-text-dim); cursor: pointer; transition: color var(--transition), transform 0.15s ease;
      border-radius: 8px;
    }
    .star-btn:hover { color: var(--clr-warning); transform: scale(1.06); }
    .star-btn--active { color: var(--clr-warning); }
    .support-box { background: rgba(var(--clr-primary-rgb), 0.03); border-style: dashed; }
    .support-text { font-size: 13px; color: var(--clr-text-muted); margin-bottom: 16px; }
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
      0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45); transform: scale(1); }
      55%  { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); transform: scale(1.01); }
      100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); transform: scale(1); }
    }
    .payment-status--failed    { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.25);  color: var(--clr-error); }
    .payment-status--processing, .payment-status--pending {
      background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.25); color: var(--clr-warning);
      animation: processing-glow 2s ease-in-out infinite;
    }
    @keyframes processing-glow {
      0%, 100% { border-color: rgba(245, 158, 11, 0.25); box-shadow: none; }
      50%       { border-color: rgba(245, 158, 11, 0.55); box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.08); }
    }
    .payment-status--processing lucide-icon:first-child,
    .payment-status--pending    lucide-icon:first-child {
      animation: spin-icon 1.2s linear infinite;
      display: inline-block;
    }
    @keyframes spin-icon {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .payment-status-label { font-weight: 700; font-size: 14px; }
    .payment-receipt { font-size: 12px; margin-top: 4px; opacity: 0.85; }
    .receipt-download-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }

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

    .card--rated-banner {
      background: rgba(34, 197, 94, 0.08);
      border-color: rgba(34, 197, 94, 0.28);
    }
    .rated-banner-inner { display: flex; align-items: flex-start; gap: 14px; }
    .rated-banner-icon { color: var(--clr-warning); flex-shrink: 0; margin-top: 2px; }
    .rated-banner-title { font-weight: 700; margin: 0 0 4px; font-size: 15px; }
    .rated-banner-sub { margin: 0; font-size: 14px; color: var(--clr-text-muted); }

    /* ── Payment success overlay ─────────────────────────────── */
    .pay-overlay {
      position: fixed; inset: 0; z-index: 9000;
      background: rgba(0,0,0,0.65); backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center;
      animation: overlay-in 0.28s ease-out;
      cursor: pointer;
    }
    @keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
    .pay-overlay-card {
      background: var(--clr-surface);
      border-radius: 24px;
      padding: 44px 32px 36px;
      text-align: center;
      max-width: 300px; width: 88%;
      animation: card-pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 30px 70px rgba(0,0,0,0.4);
      cursor: default;
    }
    @keyframes card-pop {
      from { transform: scale(0.55) translateY(20px); opacity: 0; }
      to   { transform: scale(1)    translateY(0);    opacity: 1; }
    }
    .check-wrap { width: 84px; height: 84px; margin: 0 auto 22px; }
    .check-svg  { width: 84px; height: 84px; }
    .check-circle {
      stroke-dasharray: 226; stroke-dashoffset: 226;
      animation: draw-circle 0.55s cubic-bezier(0.4,0,0.2,1) 0.12s forwards;
    }
    @keyframes draw-circle { to { stroke-dashoffset: 0; } }
    .check-mark {
      stroke-dasharray: 52; stroke-dashoffset: 52;
      animation: draw-check 0.38s ease-out 0.62s forwards;
    }
    @keyframes draw-check { to { stroke-dashoffset: 0; } }
    .pay-overlay-title  { font-size: 1.45rem; font-weight: 800; margin: 0 0 10px; color: var(--clr-text); }
    .pay-overlay-amount { font-size: 2rem; font-weight: 900; color: var(--clr-success); margin: 0 0 6px; letter-spacing: -0.5px; }
    .pay-overlay-receipt { font-size: 12px; color: var(--clr-text-muted); margin: 0 0 18px; font-family: monospace; }
    .pay-overlay-hint   { font-size: 12px; color: var(--clr-text-dim); margin: 16px 0 0; }
    .confetti-wrap { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
    .confetti-piece {
      position: absolute; width: 9px; height: 12px; top: -14px;
      left: calc(var(--ci) * 5.5% + 2%); border-radius: 2px;
      background: hsl(calc(var(--ci) * 20deg), 85%, 58%);
      animation: confetti-fall 2.4s ease-in calc(var(--ci) * 0.06s) both;
    }
    @keyframes confetti-fall {
      0%   { transform: translateY(0) rotate(0deg) scaleX(1); opacity: 1; }
      80%  { opacity: 1; }
      100% { transform: translateY(108vh) rotate(calc(var(--ci) * 35deg)) scaleX(0.7); opacity: 0; }
    }

    /* ── Enhanced review card ────────────────────────────────── */
    .rating-prompt-animate {
      animation: slide-in 0.45s cubic-bezier(0.34, 1.3, 0.64, 1);
    }
    @keyframes slide-in {
      from { transform: translateY(18px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .rating-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
    .rating-icon   { color: var(--clr-warning); flex-shrink: 0; margin-top: 2px; }
    .star-btn { padding: 5px; color: var(--clr-text-dim); cursor: pointer; transition: color 0.15s, transform 0.15s; border-radius: 8px; }
    .star-btn:hover, .star-btn--hover { color: var(--clr-warning); transform: scale(1.18); }
    .star-btn--active { color: var(--clr-warning); }
    .rating-label {
      text-align: center; font-size: 13px; font-weight: 600;
      color: var(--clr-text-muted); margin: 6px 0 14px; min-height: 20px;
    }
    .review-textarea {
      width: 100%; min-height: 76px; resize: vertical;
      border: 1px solid var(--clr-border); border-radius: var(--radius-md);
      padding: 10px 12px; font-size: 14px; color: var(--clr-text);
      background: var(--clr-surface); font-family: inherit;
      margin-bottom: 14px; transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
    }
    .review-textarea:focus {
      outline: none; border-color: var(--clr-primary);
      box-shadow: 0 0 0 3px rgba(var(--clr-primary-rgb), 0.15);
    }
    .review-textarea::placeholder { color: var(--clr-text-dim); }

    @media (max-width: 640px) {
      .detail-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class ParcelDetailComponent implements OnInit, OnDestroy {
  private readonly route          = inject(ActivatedRoute);
  private readonly parcelService  = inject(ParcelService);
  private readonly paymentService = inject(PaymentService);
  private readonly trackingService = inject(TrackingService);
  private readonly toast          = inject(ToastService);

  protected readonly parcel         = signal<Parcel | null>(null);
  protected readonly loading        = signal(true);
  protected readonly cancelling     = signal(false);
  protected readonly rated          = signal(false);
  protected readonly selectedRating = signal(0);
  protected readonly hoverRating    = signal(0);
  protected readonly submittingRating = signal(false);
  protected reviewCommentValue = '';

  // Payment success overlay
  protected readonly showPaymentSuccessOverlay = signal(false);
  protected readonly paymentSuccessAmount      = signal<number | null>(null);
  protected readonly paymentSuccessReceipt     = signal<string | null>(null);
  protected readonly confettiItems = Array.from({ length: 18 }, (_, i) => i);
  private overlayDismissTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly payment          = signal<RidePayment | null>(null);
  protected readonly payingNow        = signal(false);
  protected readonly receiptDownloading = signal(false);
  /** Becomes true after the 30-second grace window while STK push is in-flight. */
  protected readonly showResendOption = signal(false);
  private resendGraceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Timestamp (ms) when the payment last entered PROCESSING state. */
  private processingStartTime: number | null = null;
  /** Timer that defers a FAILED transition to avoid instant error flicker. */
  private failedDelayTimer: ReturnType<typeof setTimeout> | null = null;

  // Parcel-status polling after payment is confirmed
  private parcelStatusPollTimer: ReturnType<typeof setTimeout> | null = null;
  private parcelStatusPollCount = 0;
  private static readonly MAX_PARCEL_STATUS_POLLS = 72; // 6 min @ 5 s intervals

  private subscribedPaymentId: string | null = null;
  private paymentUpdateCb: ((d: unknown) => void) | null = null;
  private tripPaymentListening = false;
  private paymentPollGeneration = 0;
  private mpesaProcessingSyncTimer: ReturnType<typeof setInterval> | null = null;
  private static readonly MPESA_PROCESSING_SYNC_MS = 7_000;

  protected readonly paymentSuccessKind = computed(():
    | 'mpesa-mid'
    | 'mpesa-done'
    | 'cash-done'
    | null => {
    const parcel = this.parcel();
    if (!parcel) return null;
    const p = this.payment();
    if (parcel.paymentMethod === 'MPESA' && p?.status === 'COMPLETED') {
      if (ACTIVE_PARCEL_PAYMENT_STATUSES.includes(parcel.status)) return 'mpesa-mid';
      if (parcel.status === 'DELIVERED') return 'mpesa-done';
    }
    if (
      parcel.paymentMethod === 'CASH' &&
      parcel.status === 'DELIVERED' &&
      parcel.payment?.status === 'COMPLETED'
    ) {
      return 'cash-done';
    }
    return null;
  });

  protected readonly showRatingPrompt = computed(
    () => this.parcel()?.status === 'DELIVERED' && !this.rated(),
  );

  protected readonly showRatedThanks = computed(() => {
    const p = this.parcel();
    return p?.status === 'DELIVERED' && this.rated() && !!p.rating;
  });

  protected readonly ratingLabel = computed(() => {
    const labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];
    return labels[this.selectedRating()] ?? '';
  });

  protected dismissPaymentOverlay(): void {
    if (this.overlayDismissTimer) clearTimeout(this.overlayDismissTimer);
    this.showPaymentSuccessOverlay.set(false);
  }

  protected readonly parcelPaymentSummary = computed((): {
    text: string;
    variant: 'success' | 'warning' | 'error' | 'neutral' | 'muted';
  } => {
    const parcel = this.parcel();
    const pay = this.payment();
    if (!parcel || parcel.paymentMethod !== 'MPESA') {
      return { text: '', variant: 'neutral' };
    }
    if (!pay) {
      if (ACTIVE_PARCEL_PAYMENT_STATUSES.includes(parcel.status)) {
        return { text: 'Pay below before delivery is completed', variant: 'warning' };
      }
      if (parcel.status === 'DELIVERED') {
        return { text: 'No M-Pesa record on file', variant: 'neutral' };
      }
      return { text: 'Not started', variant: 'neutral' };
    }
    switch (pay.status) {
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

  private readonly tripPaymentHandler = (d: TripPaymentPayload) => {
    const parcel = this.parcel();
    if (!parcel || d.kind !== 'parcel' || d.entityId !== parcel.id) return;
    if (parcel.paymentMethod === 'CASH') {
      if (d.status !== 'COMPLETED') return;
      void this.parcelService.getById(parcel.id).then((fresh) => {
        this.parcel.set(fresh);
        if (fresh.payment) this.payment.set(fresh.payment as RidePayment);
        if (
          ACTIVE_PARCEL_PAYMENT_STATUSES.includes(fresh.status) &&
          fresh.payment?.status === 'COMPLETED'
        ) {
          this.startParcelStatusPoll();
        }
      });
      return;
    }
    if (d.status !== 'COMPLETED' && d.status !== 'FAILED') return;
    this.reconcileMpesaTerminalFromServer(d.status);
  };

  /**
   * M-Pesa success/failure UI only after the parcel API reflects the same payment status
   * (persisted webhook/settlement). Used for sockets, trip payment events, and poll fallbacks.
   */
  private reconcileMpesaTerminalFromServer(claimedStatus: 'COMPLETED' | 'FAILED'): void {
    const parcel = this.parcel();
    if (!parcel || parcel.paymentMethod !== 'MPESA') return;
    void this.parcelService.getById(parcel.id).then((fresh) => {
      this.parcel.set(fresh);
      const pay = fresh.payment as RidePayment | undefined;
      if (!pay) return;
      if (pay.status === 'COMPLETED' && claimedStatus === 'FAILED') {
        this.payment.set(pay);
        return;
      }
      if (pay.status !== claimedStatus) {
        this.payment.set(pay);
        return;
      }
      this.applyPaymentTerminal(
        pay.status,
        pay.mpesaReceiptNumber,
        pay.completedAt ?? null,
      );
    });
  }

  private clearMpesaProcessingHttpSync(): void {
    if (this.mpesaProcessingSyncTimer !== null) {
      clearInterval(this.mpesaProcessingSyncTimer);
      this.mpesaProcessingSyncTimer = null;
    }
  }

  private startMpesaProcessingHttpSync(): void {
    const parcel = this.parcel();
    const p = this.payment();
    if (!parcel || !p || parcel.paymentMethod !== 'MPESA' || p.status !== 'PROCESSING') {
      return;
    }
    this.clearMpesaProcessingHttpSync();
    this.mpesaProcessingSyncTimer = setInterval(() => {
      void this.tickMpesaProcessingHttpSync();
    }, ParcelDetailComponent.MPESA_PROCESSING_SYNC_MS);
  }

  private async tickMpesaProcessingHttpSync(): Promise<void> {
    const parcel = this.parcel();
    const p = this.payment();
    if (!parcel || !p || parcel.paymentMethod !== 'MPESA' || p.status !== 'PROCESSING') {
      this.clearMpesaProcessingHttpSync();
      return;
    }
    try {
      const fresh = await this.parcelService.getById(parcel.id);
      this.parcel.set(fresh);
      const fp = fresh.payment as RidePayment | undefined;
      if (!fp) return;
      this.payment.set(fp);
      if (fp.status === 'COMPLETED' || fp.status === 'FAILED') {
        this.clearMpesaProcessingHttpSync();
        this.applyPaymentTerminal(
          fp.status,
          fp.mpesaReceiptNumber,
          fp.completedAt ?? null,
        );
      }
    } catch {
      /* e.g. 504 */
    }
  }

  protected canPay(): boolean {
    const p = this.parcel();
    return !!p && p.paymentMethod === 'MPESA' && !this.payment()
      && ACTIVE_PARCEL_PAYMENT_STATUSES.includes(p.status);
  }

  /**
   * Call whenever a fresh STK push is sent.
   * Stamps the start time (used to guard against instant FAILED flicker) and
   * starts the 30-second grace window before the Resend button is revealed.
   */
  private startResendGrace(): void {
    this.clearResendGrace();
    this.clearFailedDelay();
    this.processingStartTime = Date.now();
    this.showResendOption.set(false);
    this.resendGraceTimer = setTimeout(() => this.showResendOption.set(true), 30_000);
  }

  private clearResendGrace(): void {
    if (this.resendGraceTimer !== null) {
      clearTimeout(this.resendGraceTimer);
      this.resendGraceTimer = null;
    }
  }

  private clearFailedDelay(): void {
    if (this.failedDelayTimer !== null) {
      clearTimeout(this.failedDelayTimer);
      this.failedDelayTimer = null;
    }
  }

  /**
   * After M-Pesa payment is confirmed while the parcel is still in transit,
   * poll the parcel status every 5 seconds so the UI automatically transitions
   * to DELIVERED (showing the rating prompt) once the rider marks it delivered.
   */
  private startParcelStatusPoll(): void {
    this.clearParcelStatusPoll();
    this.parcelStatusPollCount = 0;
    this.parcelStatusPollTimer = setTimeout(() => void this.pollParcelStatus(), 5_000);
  }

  private clearParcelStatusPoll(): void {
    if (this.parcelStatusPollTimer !== null) {
      clearTimeout(this.parcelStatusPollTimer);
      this.parcelStatusPollTimer = null;
    }
  }

  private async pollParcelStatus(): Promise<void> {
    this.parcelStatusPollTimer = null;
    const p = this.parcel();
    if (!p || !ACTIVE_PARCEL_PAYMENT_STATUSES.includes(p.status)) return;
    if (this.parcelStatusPollCount >= ParcelDetailComponent.MAX_PARCEL_STATUS_POLLS) return;

    this.parcelStatusPollCount++;
    try {
      const fresh = await this.parcelService.getById(p.id);
      this.parcel.set(fresh);
      if (fresh.payment) this.payment.set(fresh.payment as RidePayment);

      if (ACTIVE_PARCEL_PAYMENT_STATUSES.includes(fresh.status)) {
        this.parcelStatusPollTimer = setTimeout(() => void this.pollParcelStatus(), 5_000);
      }
    } catch {
      this.parcelStatusPollTimer = setTimeout(() => void this.pollParcelStatus(), 5_000);
    }
  }

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const p = await this.parcelService.getById(id);
      this.parcel.set(p);
      if (p.payment) {
        this.payment.set(p.payment as RidePayment);
        const pStatus = (p.payment as RidePayment).status;
        if (pStatus === 'PROCESSING') {
          this.processingStartTime = Date.now() - ParcelDetailComponent.MIN_PROCESSING_MS;
          this.showResendOption.set(true);
        }
        // Payment already confirmed but parcel not yet delivered — poll.
        if (pStatus === 'COMPLETED' && ACTIVE_PARCEL_PAYMENT_STATUSES.includes(p.status)) {
          this.startParcelStatusPoll();
        }
      }
      if (p.rating) this.rated.set(true);
      if (p.payment?.status === 'PROCESSING') {
        this.trackingService.connect();
        this.subscribePaymentSocket(p.payment.id);
        if (p.paymentMethod === 'MPESA') {
          this.startMpesaProcessingHttpSync();
        }
        if (p.payment.checkoutRequestId) {
          void this.startPaymentPollFallback(p.payment.checkoutRequestId);
        } else {
          void this.startPaymentPollFallbackById(p.payment.id);
        }
      }

      if (
        ACTIVE_PARCEL_PAYMENT_STATUSES.includes(p.status) &&
        (p.paymentMethod === 'MPESA' || p.paymentMethod === 'CASH')
      ) {
        this.trackingService.connect();
        this.trackingService.onTripPayment(this.tripPaymentHandler);
        this.tripPaymentListening = true;
      }
    } catch {
      this.toast.error('Could not load parcel');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.clearMpesaProcessingHttpSync();
    this.clearResendGrace();
    this.clearFailedDelay();
    this.clearParcelStatusPoll();
    if (this.overlayDismissTimer) clearTimeout(this.overlayDismissTimer);
    if (this.subscribedPaymentId) {
      this.trackingService.unsubscribeFromPayment(this.subscribedPaymentId);
    }
    if (this.paymentUpdateCb) {
      this.trackingService.offPaymentUpdate(this.paymentUpdateCb as (d: unknown) => void);
    }
    if (this.tripPaymentListening) {
      this.trackingService.offTripPayment(this.tripPaymentHandler);
    }
  }

  protected async downloadPaymentReceipt(paymentId: string): Promise<void> {
    this.receiptDownloading.set(true);
    try {
      const blob = await this.paymentService.downloadReceipt(paymentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nduthiride-receipt-${paymentId.slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      this.toast.success('Receipt downloaded');
    } catch {
      this.toast.error('Could not download receipt');
    } finally {
      this.receiptDownloading.set(false);
    }
  }

  protected async initiatePayment(): Promise<void> {
    const p = this.parcel();
    if (!p || !p.mpesaPhone) return;
    this.payingNow.set(true);
    try {
      const result = await this.paymentService.initiateForParcel(p.id, p.mpesaPhone, 'MPESA');
      this.payment.set({
        id: result.paymentId,
        status: 'PROCESSING',
        amount: p.deliveryFee,
        method: 'MPESA',
        mpesaReceiptNumber: null,
        completedAt: null,
        checkoutRequestId: result.checkoutRequestId ?? null,
      });
      this.toast.info('Check your phone for the M-Pesa prompt.');
      this.startResendGrace();
      this.trackingService.connect();
      this.subscribePaymentSocket(result.paymentId);
      this.startMpesaProcessingHttpSync();
      // Always poll by ID — works whether checkoutRequestId is populated or not
      void this.startPaymentPollFallbackById(result.paymentId);
    } catch (err) {
      const isServerError = err instanceof HttpErrorResponse && err.status >= 500;
      if (isServerError) {
        try {
          const fresh = await this.parcelService.getById(p.id);
          this.parcel.set(fresh);
          const pay = fresh.payment as RidePayment | undefined;
          if (pay?.status === 'PROCESSING') {
            this.payment.set(pay);
            this.toast.info('Check your phone — the M-Pesa prompt may have been sent.');
            this.startResendGrace();
            this.trackingService.connect();
            this.subscribePaymentSocket(pay.id);
            this.startMpesaProcessingHttpSync();
            void this.startPaymentPollFallbackById(pay.id);
          } else {
            this.toast.error('Could not initiate payment. Try again.');
          }
        } catch {
          this.toast.error('Could not initiate payment. Try again.');
        }
      } else {
        const msg =
          err instanceof HttpErrorResponse &&
          err.error &&
          typeof err.error.message === 'string'
            ? err.error.message
            : null;
        this.toast.error(msg ?? 'Could not initiate payment. Try again.');
      }
    } finally {
      this.payingNow.set(false);
    }
  }

  protected async resendPayment(): Promise<void> {
    const p = this.payment();
    const parcel = this.parcel();
    if (!p || !parcel) return;
    this.payingNow.set(true);
    // Drop any in-flight poll from the previous STK attempt so a late FAILED/COMPLETED
    // result cannot overwrite state after this resend starts.
    this.paymentPollGeneration++;
    this.clearMpesaProcessingHttpSync();
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
        amount: parcel.deliveryFee,
        method: 'MPESA',
        mpesaReceiptNumber: null,
        completedAt: null,
        checkoutRequestId: result.checkoutRequestId ?? null,
      });
      this.toast.info('Check your phone for the M-Pesa prompt.');
      this.startResendGrace();
      this.trackingService.connect();
      this.subscribePaymentSocket(result.paymentId);
      this.startMpesaProcessingHttpSync();
      if (result.checkoutRequestId) {
        void this.startPaymentPollFallback(result.checkoutRequestId);
      } else {
        void this.startPaymentPollFallbackById(result.paymentId);
      }
    } catch (err) {
      const isServerError = err instanceof HttpErrorResponse && err.status >= 500;
      if (isServerError) {
        try {
          const fresh = await this.parcelService.getById(parcel.id);
          this.parcel.set(fresh);
          const pay = fresh.payment as RidePayment | undefined;
          if (pay?.status === 'PROCESSING') {
            this.payment.set(pay);
            this.toast.info('Check your phone — the M-Pesa prompt may have been sent.');
            this.startResendGrace();
            this.trackingService.connect();
            this.subscribePaymentSocket(pay.id);
            this.startMpesaProcessingHttpSync();
            if (pay.checkoutRequestId) {
              void this.startPaymentPollFallback(pay.checkoutRequestId);
            } else {
              void this.startPaymentPollFallbackById(pay.id);
            }
          } else {
            this.toast.error('Could not resend payment prompt. Try again.');
          }
        } catch {
          this.toast.error('Could not resend payment prompt. Try again.');
        }
      } else {
        this.toast.error('Could not resend payment prompt. Try again.');
      }
    } finally {
      this.payingNow.set(false);
    }
  }

  private async startPaymentPollFallback(checkoutRequestId: string): Promise<void> {
    const gen = ++this.paymentPollGeneration;
    try {
      const res = await this.paymentService.pollStatus(checkoutRequestId);
      if (gen !== this.paymentPollGeneration) return;
      if (res.status === 'COMPLETED' || res.status === 'FAILED') {
        this.reconcileMpesaTerminalFromServer(res.status);
      }
    } catch {
      /* timeout or network */
    }
  }

  private async startPaymentPollFallbackById(paymentId: string): Promise<void> {
    const gen = ++this.paymentPollGeneration;
    try {
      const res = await this.paymentService.pollStatusById(paymentId);
      if (gen !== this.paymentPollGeneration) return;
      if (res.status === 'COMPLETED' || res.status === 'FAILED') {
        this.reconcileMpesaTerminalFromServer(res.status);
      }
    } catch {
      /* timeout or network */
    }
  }

  private static readonly MIN_PROCESSING_MS = 30_000;

  private applyPaymentTerminal(
    status: string,
    mpesaReceiptNumber: string | null | undefined,
    completedAt: string | null | undefined,
  ): void {
    const prev = this.payment()?.status;
    if (prev === status) return;

    if (status === 'FAILED' && prev === 'PROCESSING' && this.processingStartTime !== null) {
      const elapsed = Date.now() - this.processingStartTime;
      const remaining = ParcelDetailComponent.MIN_PROCESSING_MS - elapsed;
      if (remaining > 0) {
        this.clearFailedDelay();
        this.failedDelayTimer = setTimeout(
          () => {
            this.failedDelayTimer = null;
            if (this.payment()?.status !== 'COMPLETED') {
              this.applyPaymentTerminal(status, mpesaReceiptNumber, completedAt);
            }
          },
          remaining,
        );
        return;
      }
    }

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
      this.clearFailedDelay();
      this.showResendOption.set(false);

      // Show full-screen animated success overlay
      const p = this.payment();
      this.paymentSuccessAmount.set(p?.amount ?? null);
      this.paymentSuccessReceipt.set(mpesaReceiptNumber ?? p?.mpesaReceiptNumber ?? null);
      this.showPaymentSuccessOverlay.set(true);
      if (this.overlayDismissTimer) clearTimeout(this.overlayDismissTimer);
      this.overlayDismissTimer = setTimeout(() => this.showPaymentSuccessOverlay.set(false), 4000);

      const pid = this.parcel()?.id;
      if (pid) {
        void this.parcelService.getById(pid).then((fresh) => {
          this.parcel.set(fresh);
          if (fresh.payment) this.payment.set(fresh.payment as RidePayment);
          // If the parcel hasn't been delivered yet, poll so the UI auto-transitions
          // to DELIVERED and shows the rating prompt when the rider marks it done.
          if (ACTIVE_PARCEL_PAYMENT_STATUSES.includes(fresh.status)) {
            this.startParcelStatusPoll();
          }
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
        this.reconcileMpesaTerminalFromServer(d.status);
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

  protected async cancel(): Promise<void> {
    const id = this.parcel()?.id;
    if (!id) return;
    this.cancelling.set(true);
    try {
      const updated = await this.parcelService.updateStatus(id, 'CANCELLED');
      this.parcel.set(updated);
      this.toast.success('Delivery cancelled');
    } catch {
      this.toast.error('Could not cancel delivery');
    } finally {
      this.cancelling.set(false);
    }
  }

  protected async submitRating(): Promise<void> {
    const id = this.parcel()?.id;
    if (!id || this.selectedRating() === 0 || this.submittingRating()) return;
    const score = this.selectedRating();
    const comment = this.reviewCommentValue.trim() || undefined;
    this.submittingRating.set(true);
    try {
      await this.parcelService.rate(id, score, comment);
      this.rated.set(true);
      this.selectedRating.set(0);
      this.reviewCommentValue = '';
      const fresh = await this.parcelService.getById(id);
      this.parcel.set(fresh);
      if (fresh.payment) this.payment.set(fresh.payment as RidePayment);
      this.toast.success('Thank you for your feedback!');
    } catch {
      this.toast.error('Rating failed');
    } finally {
      this.submittingRating.set(false);
    }
  }

  protected badge(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'pending', DELIVERED: 'active', CANCELLED: 'closed', IN_TRANSIT: 'info',
    };
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
