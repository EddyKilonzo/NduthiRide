import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ParcelService } from '../../../core/services/parcel.service';
import { MapService } from '../../../core/services/map.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import {
  RoutePickerMapComponent,
  type RouteMapPoint,
} from '../../../shared/components/route-picker-map/route-picker-map.component';

const KE_PHONE = /^(\+254|0)(7|1)\d{8}$/;

@Component({
  selector: 'app-book-parcel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SpinnerComponent,
    RoutePickerMapComponent,
    LucideAngularModule,
  ],
  template: `
    <div class="book-parcel-page app-page">
      <div class="book-parcel-panel">
        <header class="book-parcel-hero">
          <span class="book-parcel-hero__badge" aria-hidden="true">
            <lucide-icon name="package" [size]="24"></lucide-icon>
          </span>
          <div class="book-parcel-hero__text">
            <h1 class="book-parcel-hero__title">Send a Parcel</h1>
            <p class="book-parcel-hero__lead">Describe the item, set both stops, get a fee quote.</p>
          </div>
        </header>

        <p class="book-parcel-hint">
          <lucide-icon name="truck" [size]="14" class="book-parcel-hint__icon"></lucide-icon>
          Use <strong>current location</strong> or <strong>pick on map</strong> for pickup, or type addresses. Blur fields to validate.
        </p>

        <div class="form-shell book-parcel-form">
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="form-section">
              <h3 class="section-title">What you are sending</h3>
              <div class="parcel-item-grid">
                <div class="form-group parcel-field parcel-item-grid__wide">
                  <label for="parcel-desc">Description</label>
                  <span class="form-hint" id="parcel-desc-hint">Short label the rider will see.</span>
                  <input
                    id="parcel-desc"
                    formControlName="itemDescription"
                    class="form-control"
                    [attr.aria-invalid]="showErr('itemDescription')"
                    [attr.aria-describedby]="descIds('itemDescription', 'parcel-desc')"
                    placeholder="e.g. Sealed documents"
                  />
                  @if (showErr('itemDescription')) {
                    <span class="form-error" [id]="'parcel-desc-err'" role="alert">{{ fieldMsg('itemDescription') }}</span>
                  }
                </div>
                <div class="form-group parcel-field">
                  <label for="parcel-weight">Weight (kg)</label>
                  <span class="form-hint" id="parcel-weight-hint">Used for pricing.</span>
                  <input
                    id="parcel-weight"
                    formControlName="weightKg"
                    class="form-control"
                    type="number"
                    min="0.1"
                    step="0.1"
                    inputmode="decimal"
                    [attr.aria-invalid]="showErr('weightKg')"
                    [attr.aria-describedby]="descIds('weightKg', 'parcel-weight')"
                    placeholder="1.5"
                  />
                  @if (showErr('weightKg')) {
                    <span class="form-error" [id]="'parcel-weight-err'" role="alert">{{ fieldMsg('weightKg') }}</span>
                  }
                </div>
              </div>
            </div>

            <div class="form-section form-section--accent">
              <h3 class="section-title">Pickup</h3>
              <div class="form-group parcel-field">
                <label for="parcel-pickup">Address</label>
                <span class="form-hint" id="parcel-pickup-hint">Where the rider collects from.</span>
                <div class="parcel-locate-row parcel-locate-row--split">
                  <button
                    type="button"
                    class="btn btn--ghost btn--compact parcel-locate-btn"
                    (click)="usePickupCurrentLocation()"
                    [disabled]="locatingPickup()"
                    aria-label="Fill pickup with your current GPS location"
                  >
                    @if (locatingPickup()) {
                      <app-spinner [size]="14" />
                    } @else {
                      <lucide-icon name="navigation" [size]="16" aria-hidden="true"></lucide-icon>
                    }
                    Current location
                  </button>
                  <button
                    type="button"
                    class="btn btn--ghost btn--compact parcel-locate-btn"
                    [class.parcel-locate-btn--active]="mapPickMode() === 'pickup'"
                    (click)="startMapPick('pickup')"
                    aria-label="Choose pickup by tapping the map"
                  >
                    <lucide-icon name="map-pin" [size]="16" aria-hidden="true"></lucide-icon>
                    Pick on map
                  </button>
                </div>
                <input
                  id="parcel-pickup"
                  formControlName="pickupAddress"
                  class="form-control"
                  [attr.aria-invalid]="showErr('pickupAddress')"
                  [attr.aria-describedby]="descIds('pickupAddress', 'parcel-pickup')"
                  placeholder="Collection point"
                  (input)="onAddressInput($event, 'pickup')"
                />
                @if (showErr('pickupAddress')) {
                  <span class="form-error" [id]="'parcel-pickup-err'" role="alert">{{ fieldMsg('pickupAddress') }}</span>
                }
              </div>
            </div>

            <div class="form-section">
              <h3 class="section-title">Delivery & recipient</h3>
              <div class="form-group parcel-field">
                <label for="parcel-dropoff">Drop-off address</label>
                <span class="form-hint" id="parcel-dropoff-hint">Recipient&apos;s location.</span>
                <div class="parcel-locate-row">
                  <button
                    type="button"
                    class="btn btn--ghost btn--compact parcel-locate-btn"
                    [class.parcel-locate-btn--active]="mapPickMode() === 'dropoff'"
                    (click)="startMapPick('dropoff')"
                    aria-label="Choose delivery point by tapping the map"
                  >
                    <lucide-icon name="map-pin" [size]="16" aria-hidden="true"></lucide-icon>
                    Pick on map
                  </button>
                </div>
                <input
                  id="parcel-dropoff"
                  formControlName="dropoffAddress"
                  class="form-control"
                  [attr.aria-invalid]="showErr('dropoffAddress')"
                  [attr.aria-describedby]="descIds('dropoffAddress', 'parcel-dropoff')"
                  placeholder="Delivery address"
                  (input)="onAddressInput($event, 'dropoff')"
                />
                @if (showErr('dropoffAddress')) {
                  <span class="form-error" [id]="'parcel-dropoff-err'" role="alert">{{ fieldMsg('dropoffAddress') }}</span>
                }
              </div>
              <div class="parcel-recipient-grid">
                <div class="form-group parcel-field">
                  <label for="parcel-recipient-name">Recipient name</label>
                  <span class="form-hint" id="parcel-recipient-name-hint">Full name</span>
                  <input
                    id="parcel-recipient-name"
                    formControlName="recipientName"
                    class="form-control"
                    [attr.aria-invalid]="showErr('recipientName')"
                    [attr.aria-describedby]="descIds('recipientName', 'parcel-recipient-name')"
                    placeholder="e.g. Jane Wanjiku"
                  />
                  @if (showErr('recipientName')) {
                    <span class="form-error" [id]="'parcel-recipient-name-err'" role="alert">{{ fieldMsg('recipientName') }}</span>
                  }
                </div>
                <div class="form-group parcel-field">
                  <label for="parcel-recipient-phone">Recipient phone</label>
                  <span class="form-hint" id="parcel-recipient-phone-hint">07… or +254…</span>
                  <input
                    id="parcel-recipient-phone"
                    formControlName="recipientPhone"
                    class="form-control"
                    type="tel"
                    inputmode="tel"
                    autocomplete="tel"
                    [attr.aria-invalid]="showErr('recipientPhone')"
                    [attr.aria-describedby]="descIds('recipientPhone', 'parcel-recipient-phone')"
                    placeholder="07XXXXXXXX"
                  />
                  @if (showErr('recipientPhone')) {
                    <span class="form-error" [id]="'parcel-recipient-phone-err'" role="alert">{{ fieldMsg('recipientPhone') }}</span>
                  }
                </div>
              </div>
            </div>

            <div class="form-section">
              <h3 class="section-title">Payment</h3>
              <div class="form-group parcel-field">
                <label for="parcel-pay">Method</label>
                <select id="parcel-pay" formControlName="paymentMethod" class="form-control">
                  <option value="MPESA">M-Pesa</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              @if (form.get('paymentMethod')?.value === 'MPESA') {
                <div class="form-group parcel-field">
                  <label for="parcel-mpesa">M-Pesa phone</label>
                  <span class="form-hint" id="parcel-mpesa-hint">Number to charge.</span>
                  <input
                    id="parcel-mpesa"
                    formControlName="mpesaPhone"
                    class="form-control"
                    type="tel"
                    inputmode="tel"
                    [attr.aria-invalid]="showErr('mpesaPhone')"
                    [attr.aria-describedby]="descIds('mpesaPhone', 'parcel-mpesa')"
                    placeholder="07XXXXXXXX"
                  />
                  @if (showErr('mpesaPhone')) {
                    <span class="form-error" [id]="'parcel-mpesa-err'" role="alert">{{ fieldMsg('mpesaPhone') }}</span>
                  }
                </div>
              }
            </div>

            @if (feeEstimate()) {
              <div class="estimate-card" role="status">
                <div class="estimate-card__head">
                  <lucide-icon name="wallet" [size]="18"></lucide-icon>
                  <span>Delivery quote</span>
                </div>
                <div class="est-row">
                  <span>Distance</span>
                  <strong>{{ feeEstimate()!.distanceKm | number:'1.1-1' }} km</strong>
                </div>
                <div class="est-row est-row--total">
                  <span>Delivery fee</span>
                  <strong class="text-primary">KES {{ feeEstimate()!.deliveryFee | number:'1.0-0' }}</strong>
                </div>
              </div>
            }

            <div class="form-actions-row book-parcel-actions">
              <button type="button" class="btn btn--secondary btn--compact" (click)="getEstimate()" [disabled]="estimating()">
                @if (estimating()) { <app-spinner [size]="16" /> } @else { Get fee estimate }
              </button>
              <button type="submit" class="btn btn--primary btn--full btn--compact" [disabled]="loading()">
                @if (loading()) { <app-spinner [size]="18" /> } @else { Place order }
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="book-parcel-map-wrap">
        <span class="book-parcel-map-label">Map picker</span>
        @if (mapPickMode(); as pickLeg) {
          <div class="parcel-map-pick-banner" role="status">
            <p>
              @if (pickLeg === 'pickup') {
                Tap the map to set <strong>pickup</strong>
              } @else {
                Tap the map to set <strong>delivery</strong>
              }
            </p>
            <button type="button" class="btn btn--ghost btn--sm" (click)="cancelMapPick()">Cancel</button>
          </div>
        }
        <app-route-picker-map
          class="book-parcel-map"
          [pickup]="pickupPoint()"
          [dropoff]="dropoffPoint()"
          [pickMode]="mapPickMode()"
          (locationPicked)="onMapLocationPicked($event)"
        />
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }
    /* No inner column scroll — let the shell scroll the whole page */
    .book-parcel-page {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 1320px;
      margin-inline: auto;
      min-height: min(480px, calc(100dvh - 200px));
      border-radius: var(--radius-lg);
      overflow-x: hidden;
      overflow-y: visible;
      border: 1px solid var(--clr-border);
      box-shadow: var(--shadow-card);
      background: var(--clr-bg-card);
      padding-bottom: env(safe-area-inset-bottom, 0px);
      box-sizing: border-box;
    }
    .book-parcel-panel {
      display: flex;
      flex-direction: column;
      gap: clamp(10px, 2vw, 14px);
      padding: clamp(12px, 4vw, 22px);
      padding-left: max(12px, env(safe-area-inset-left, 0px));
      padding-right: max(12px, env(safe-area-inset-right, 0px));
      border-bottom: 1px solid var(--clr-border);
      overflow: visible;
      max-height: none;
      min-height: 0;
    }
    .book-parcel-hero {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      text-align: left;
    }
    .book-parcel-hero__badge {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: linear-gradient(145deg, var(--clr-secondary-light), var(--clr-primary-dark));
      color: var(--clr-primary-light);
      box-shadow: 0 6px 18px rgba(9, 20, 19, 0.4);
    }
    .book-parcel-hero__title {
      font-family: var(--font-display);
      font-size: clamp(1.2rem, 2.8vw, 1.45rem);
      font-weight: 800;
      color: var(--clr-text);
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin: 0;
    }
    .book-parcel-hero__lead {
      font-size: 12px;
      color: var(--clr-text-muted);
      margin: 4px 0 0;
      line-height: 1.4;
      max-width: 38ch;
    }
    .book-parcel-hint {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0;
      padding: 8px 10px;
      font-size: 11px;
      line-height: 1.4;
      color: var(--clr-text-muted);
      background: color-mix(in srgb, var(--clr-primary) 10%, var(--clr-bg-elevated));
      border: 1px solid color-mix(in srgb, var(--clr-primary) 22%, var(--clr-border));
      border-radius: var(--radius-md);
    }
    .book-parcel-hint__icon { flex-shrink: 0; margin-top: 1px; color: var(--clr-primary-light); opacity: 0.95; }
    .book-parcel-form {
      margin: 0;
      max-width: none;
      padding: 0;
      background: transparent;
      border: none;
      box-shadow: none;
    }
    .book-parcel-form .form-section:first-of-type { margin-top: 0; padding-top: 0; border-top: none; }
    .book-parcel-form .form-section + .form-section {
      margin-top: 12px;
      padding-top: 12px;
    }
    .book-parcel-form .section-title {
      font-size: 10px;
      margin-bottom: 2px;
    }
    .parcel-field.form-group {
      gap: 3px;
    }
    .parcel-field.form-group label {
      font-size: 10px;
      letter-spacing: 0.06em;
    }
    .parcel-field .form-hint {
      font-size: 10px;
      line-height: 1.3;
      color: var(--clr-text-dim);
      margin: 0 0 1px;
    }
    .parcel-field .form-control {
      padding: 7px 10px;
      font-size: 13px;
      border-radius: var(--radius-sm);
      min-height: 36px;
    }
    .parcel-field select.form-control {
      padding: 6px 10px;
      min-height: 36px;
    }
    .parcel-field .form-error {
      font-size: 11px;
      margin-top: 1px;
    }
    .form-section--accent {
      padding: 10px 10px 2px;
      margin-left: -2px;
      margin-right: -2px;
      background: color-mix(in srgb, var(--clr-bg-elevated) 70%, transparent);
      border-radius: var(--radius-md);
      border: 1px solid var(--clr-border);
    }
    .form-section--accent + .form-section {
      margin-top: 12px;
      padding-top: 12px;
    }
    .parcel-locate-row {
      margin: 4px 0 6px;
    }
    .parcel-locate-row--split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    @media (max-width: 420px) {
      .parcel-locate-row--split {
        grid-template-columns: 1fr;
      }
    }
    .parcel-locate-btn {
      width: 100%;
      justify-content: center;
      gap: 6px;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 600;
      color: var(--clr-primary-light);
      border: 1px dashed color-mix(in srgb, var(--clr-primary) 45%, var(--clr-border));
      border-radius: var(--radius-sm);
      background: color-mix(in srgb, var(--clr-primary) 8%, transparent);
    }
    .parcel-locate-btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--clr-primary) 14%, transparent);
      border-style: solid;
      color: var(--clr-text);
    }
    .parcel-locate-btn--active {
      border-style: solid;
      border-color: var(--clr-primary);
      background: color-mix(in srgb, var(--clr-primary) 18%, transparent);
      color: var(--clr-text);
    }
    .parcel-locate-btn:disabled { opacity: 0.75; }
    .parcel-map-pick-banner {
      position: absolute;
      z-index: 3;
      left: 50%;
      top: 44px;
      transform: translateX(-50%);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 10px 14px;
      max-width: calc(100% - 24px);
      padding: 10px 14px;
      font-size: 12px;
      line-height: 1.35;
      color: var(--clr-text);
      background: color-mix(in srgb, var(--clr-bg-card) 92%, transparent);
      border: 1px solid var(--clr-primary);
      border-radius: var(--radius-md);
      backdrop-filter: blur(10px);
      box-shadow: var(--shadow-md);
    }
    .parcel-map-pick-banner p { margin: 0; text-align: center; }
    .parcel-map-pick-banner .btn { flex-shrink: 0; }
    .parcel-item-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: 1fr;
    }
    @media (min-width: 480px) {
      .parcel-item-grid {
        grid-template-columns: 1fr min(108px, 30%);
      }
      .parcel-item-grid__wide { grid-column: 1 / -1; }
    }
    .parcel-recipient-grid {
      display: grid;
      gap: 10px 12px;
      grid-template-columns: 1fr;
      align-items: start;
    }
    @media (min-width: 480px) {
      .parcel-recipient-grid {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
    }
    .book-parcel-map-wrap {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: min(320px, 42vh);
      background: var(--clr-bg-elevated);
      overflow: hidden;
      border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    }
    .book-parcel-map-label {
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 2;
      padding: 5px 10px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--clr-text);
      background: color-mix(in srgb, var(--clr-bg-card) 88%, transparent);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-sm);
      backdrop-filter: blur(8px);
    }
    .book-parcel-map { flex: 1; width: 100%; min-height: 0; }
    .book-parcel-form .book-parcel-actions {
      margin-top: 2px;
      gap: 10px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }
    .book-parcel-form .book-parcel-actions .btn {
      width: 100%;
      min-height: 44px;
      justify-content: center;
    }
    @media (min-width: 480px) {
      .book-parcel-form .book-parcel-actions {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: stretch;
      }
      .book-parcel-form .book-parcel-actions .btn {
        width: auto;
        flex: 1;
        min-width: min(100%, 160px);
      }
      .book-parcel-form .book-parcel-actions .btn--full {
        flex: 1 1 220px;
      }
    }
    .btn--compact { padding: 9px 16px; font-size: 13px; }
    @media (min-width: 900px) {
      .book-parcel-page {
        flex-direction: row;
        align-items: stretch;
        min-height: calc(100dvh - 200px);
        overflow-x: hidden;
        overflow-y: visible;
      }
      .book-parcel-panel {
        width: min(100%, 420px);
        flex-shrink: 0;
        border-bottom: none;
        border-right: 1px solid var(--clr-border);
        overflow: visible;
        max-height: none;
      }
      .book-parcel-map-wrap {
        border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
        min-height: 0;
        flex: 1 1 50%;
      }
    }
    @media (max-width: 899px) {
      .book-parcel-map-wrap {
        min-height: clamp(240px, 42vh, 360px);
      }
    }
    @supports (height: 100dvh) {
      @media (max-width: 899px) {
        .book-parcel-map-wrap {
          min-height: clamp(240px, 42dvh, 360px);
        }
      }
    }
    @media (max-width: 899px) and (orientation: landscape) and (max-height: 520px) {
      .book-parcel-map-wrap {
        min-height: clamp(180px, 38vh, 260px);
      }
    }
    @media (max-width: 599px) {
      .book-parcel-hero { flex-direction: column; align-items: center; text-align: center; }
      .book-parcel-hero__lead { margin-inline: auto; max-width: 100%; }
      .book-parcel-hint { font-size: 10px; padding: 8px; }
      .parcel-map-pick-banner {
        top: 38px;
        padding: 8px 10px;
        font-size: 11px;
        max-width: calc(100% - 16px);
      }
    }
    @media (max-width: 380px) {
      .book-parcel-page { border-radius: var(--radius-md); }
      .form-section--accent {
        margin-left: 0;
        margin-right: 0;
        padding-left: 8px;
        padding-right: 8px;
      }
      .parcel-field .form-control { font-size: 16px; }
      .est-row:not(.est-row--total) {
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }
      .est-row--total {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: baseline;
      }
    }
    .estimate-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 2px;
      padding: 12px 14px 12px 16px;
      background: var(--clr-bg-elevated);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-md);
      border-left: 4px solid var(--clr-primary);
      box-shadow: var(--shadow-sm);
    }
    .estimate-card__head {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--clr-text-muted);
      margin-bottom: 0;
    }
    .estimate-card__head lucide-icon { color: var(--clr-primary-light); }
    .est-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
      font-size: 13px;
      color: var(--clr-text-muted);
    }
    .est-row strong { color: var(--clr-text); font-weight: 600; }
    .est-row--total {
      font-size: 15px;
      padding-top: 8px;
      margin-top: 0;
      border-top: 1px solid var(--clr-border);
      color: var(--clr-text);
    }
    .est-row--total span { color: var(--clr-text-muted); font-size: 12px; }
  `],
})
export class BookParcelComponent {
  private readonly fb = inject(FormBuilder);
  private readonly parcelService = inject(ParcelService);
  private readonly mapApi = inject(MapService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly estimating = signal(false);
  protected readonly feeEstimate = signal<{ deliveryFee: number; distanceKm: number } | null>(null);
  protected readonly submitAttempted = signal(false);

  protected readonly pickupPoint = signal<RouteMapPoint | null>(null);
  protected readonly dropoffPoint = signal<RouteMapPoint | null>(null);
  protected readonly locatingPickup = signal(false);
  protected readonly mapPickMode = signal<'pickup' | 'dropoff' | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      itemDescription: ['', Validators.required],
      weightKg: [1, [Validators.required, Validators.min(0.1)]],
      pickupAddress: ['', Validators.required],
      dropoffAddress: ['', Validators.required],
      recipientName: ['', Validators.required],
      recipientPhone: ['', [Validators.required, Validators.pattern(KE_PHONE)]],
      paymentMethod: ['MPESA' as 'MPESA' | 'CASH', Validators.required],
      mpesaPhone: [''],
    },
    { updateOn: 'blur' },
  );

  constructor() {
    const methodCtrl = this.form.controls.paymentMethod;
    const mpesaCtrl = this.form.controls.mpesaPhone;
    const syncMpesa = (method: 'MPESA' | 'CASH') => {
      if (method === 'MPESA') {
        mpesaCtrl.setValidators([Validators.required, Validators.pattern(KE_PHONE)]);
      } else {
        mpesaCtrl.clearValidators();
        mpesaCtrl.setValue('');
      }
      mpesaCtrl.updateValueAndValidity({ emitEvent: false });
    };
    syncMpesa(methodCtrl.value);
    methodCtrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((m) => syncMpesa(m));
  }

  /** aria-describedby: hint + error when shown */
  protected descIds(name: string, base: string): string {
    const hintId = `${base}-hint`;
    if (this.showErr(name)) {
      return `${hintId} ${base}-err`;
    }
    return hintId;
  }

  protected showErr(name: string): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || this.submitAttempted());
  }

  protected fieldMsg(name: string): string {
    const c = this.form.get(name);
    const e = c?.errors;
    if (!e) return '';
    if (e['required']) return 'Required';
    if (e['pattern']) return 'Use a valid Kenyan number (07… or +254…)';
    if (e['min']) return `At least ${(e['min'] as { min: number }).min} kg`;
    return 'Invalid';
  }

  private touchHaptic(): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(14);
    }
  }

  protected startMapPick(leg: 'pickup' | 'dropoff'): void {
    this.mapPickMode.update((m) => (m === leg ? null : leg));
  }

  protected cancelMapPick(): void {
    this.mapPickMode.set(null);
  }

  protected onMapLocationPicked(e: { leg: 'pickup' | 'dropoff'; lng: number; lat: number }): void {
    this.mapPickMode.set(null);
    void this.mapApi
      .reverseGeocode(e.lat, e.lng)
      .then((place) => {
        if (e.leg === 'pickup') {
          this.form.controls.pickupAddress.setValue(place.full_address);
          this.form.controls.pickupAddress.markAsTouched();
          this.pickupPoint.set({ lat: e.lat, lng: e.lng });
          this.toast.success('Pickup set from map');
        } else {
          this.form.controls.dropoffAddress.setValue(place.full_address);
          this.form.controls.dropoffAddress.markAsTouched();
          this.dropoffPoint.set({ lat: e.lat, lng: e.lng });
          this.toast.success('Delivery point set from map');
        }
      })
      .catch(() => this.toast.error('Could not resolve address for that point'));
  }

  protected usePickupCurrentLocation(): void {
    if (this.locatingPickup()) return;
    this.mapPickMode.set(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.toast.warning('This browser does not support location');
      return;
    }
    this.locatingPickup.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        void this.mapApi
          .reverseGeocode(lat, lng)
          .then((place) => {
            this.form.controls.pickupAddress.setValue(place.full_address);
            this.form.controls.pickupAddress.markAsTouched();
            this.pickupPoint.set({ lat, lng });
            this.toast.success('Pickup set from your location');
          })
          .catch(() => {
            this.toast.error('Could not resolve address for this position');
          })
          .finally(() => this.locatingPickup.set(false));
      },
      (err) => {
        this.locatingPickup.set(false);
        if (err.code === 1) {
          this.toast.warning('Location blocked — allow access or type pickup manually');
        } else {
          this.toast.error('Could not read your position. Try again or enter the address.');
        }
      },
      { enableHighAccuracy: true, timeout: 18_000, maximumAge: 60_000 },
    );
  }

  protected onAddressInput(event: Event, type: 'pickup' | 'dropoff'): void {
    const val = (event.target as HTMLInputElement).value;
    if (val.length < 3) return;
    void this.mapApi.geocode(val).then((res) => {
      if (res.length === 0) return;
      const pt: RouteMapPoint = { lng: res[0].lng, lat: res[0].lat };
      if (type === 'pickup') this.pickupPoint.set(pt);
      else this.dropoffPoint.set(pt);
    });
  }

  protected getEstimate(): void {
    this.form.controls.pickupAddress.markAsTouched();
    this.form.controls.dropoffAddress.markAsTouched();
    this.form.controls.weightKg.markAsTouched();
    if (
      this.form.controls.pickupAddress.invalid ||
      this.form.controls.dropoffAddress.invalid ||
      this.form.controls.weightKg.invalid
    ) {
      this.submitAttempted.set(true);
      this.touchHaptic();
      return;
    }
    const pickup = this.pickupPoint();
    const dropoff = this.dropoffPoint();
    if (!pickup || !dropoff) {
      this.toast.warning('Enter both pickup and delivery addresses first');
      this.touchHaptic();
      return;
    }
    this.estimating.set(true);
    const { weightKg } = this.form.getRawValue();
    void this.parcelService
      .estimate({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        weightKg,
      })
      .then((res) => {
        this.feeEstimate.set(res);
        this.estimating.set(false);
      })
      .catch(() => {
        this.toast.error('Estimate failed');
        this.estimating.set(false);
      });
  }

  protected submit(): void {
    if (this.loading()) return;
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.touchHaptic();
      return;
    }
    const pickup = this.pickupPoint();
    const dropoff = this.dropoffPoint();
    if (!pickup || !dropoff) {
      this.toast.warning('Could not place pins for both addresses — check spelling and try again');
      this.touchHaptic();
      return;
    }
    this.loading.set(true);
    const v = this.form.getRawValue();

    void this.parcelService
      .create({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: v.pickupAddress,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffAddress: v.dropoffAddress,
        itemDescription: v.itemDescription,
        weightKg: v.weightKg,
        recipientName: v.recipientName,
        recipientPhone: v.recipientPhone,
        paymentMethod: v.paymentMethod,
        mpesaPhone: v.mpesaPhone || undefined,
      })
      .then((parcel) => {
        this.toast.success('Parcel order placed! Looking for a nearby rider...');
        void this.router.navigate(['/user/parcels', parcel.id]);
      })
      .catch((err: { error?: { message?: string } }) => {
        this.toast.error(err.error?.message ?? 'Order failed');
        this.loading.set(false);
      });
  }
}
