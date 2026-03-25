import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { RideService } from '../../../core/services/ride.service';
import { MapService } from '../../../core/services/map.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import {
  RoutePickerMapComponent,
  type RouteMapPoint,
} from '../../../shared/components/route-picker-map/route-picker-map.component';

const KE_PHONE = /^(\+254|0)(7|1)\d{8}$/;

@Component({
  selector: 'app-book-ride',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SpinnerComponent,
    RoutePickerMapComponent,
    LucideAngularModule,
  ],
  template: `
    <div class="book-page app-page">
      <div class="book-panel">
        <header class="book-hero">
          <span class="book-hero__badge" aria-hidden="true">
            <lucide-icon name="bike" [size]="24"></lucide-icon>
          </span>
          <div class="book-hero__text">
            <h1 class="book-hero__title">Book a Ride</h1>
            <p class="book-hero__lead">Set pickup and drop-off, check the fare, then confirm.</p>
          </div>
        </header>

        <p class="book-hint">
          <lucide-icon name="map-pin" [size]="14" class="book-hint__icon"></lucide-icon>
          Use <strong>current location</strong> or <strong>pick on map</strong>, or type an address. Blur fields to validate.
        </p>

        <div class="form-shell book-form-shell">
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="form-section form-section--accent">
              <h3 class="section-title">Pickup</h3>
              <div class="form-group book-field">
                <label for="ride-pickup">Address</label>
                <span class="form-hint" id="ride-pickup-hint">Where the rider should meet you.</span>
                <div class="book-locate-row book-locate-row--split">
                  <button
                    type="button"
                    class="btn btn--ghost btn--compact book-locate-btn"
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
                    class="btn btn--ghost btn--compact book-locate-btn"
                    [class.book-locate-btn--active]="mapPickMode() === 'pickup'"
                    (click)="startMapPick('pickup')"
                    aria-label="Choose pickup by tapping the map"
                  >
                    <lucide-icon name="map-pin" [size]="16" aria-hidden="true"></lucide-icon>
                    Pick on map
                  </button>
                </div>
                <input
                  id="ride-pickup"
                  formControlName="pickupAddress"
                  class="form-control"
                  [attr.aria-invalid]="showErr('pickupAddress')"
                  [attr.aria-describedby]="descIds('pickupAddress', 'ride-pickup')"
                  placeholder="e.g. Sarit Centre, Westlands"
                  (input)="onPickupInput($event)"
                />
                @if (showErr('pickupAddress')) {
                  <span id="ride-pickup-err" class="form-error" role="alert">{{ fieldMsg('pickupAddress') }}</span>
                }
              </div>
            </div>

            <div class="form-section">
              <h3 class="section-title">Drop-off</h3>
              <div class="form-group book-field">
                <label for="ride-dropoff">Address</label>
                <span class="form-hint" id="ride-dropoff-hint">Your destination — map updates when found.</span>
                <div class="book-locate-row">
                  <button
                    type="button"
                    class="btn btn--ghost btn--compact book-locate-btn"
                    [class.book-locate-btn--active]="mapPickMode() === 'dropoff'"
                    (click)="startMapPick('dropoff')"
                    aria-label="Choose drop-off by tapping the map"
                  >
                    <lucide-icon name="map-pin" [size]="16" aria-hidden="true"></lucide-icon>
                    Pick on map
                  </button>
                </div>
                <input
                  id="ride-dropoff"
                  formControlName="dropoffAddress"
                  class="form-control"
                  [attr.aria-invalid]="showErr('dropoffAddress')"
                  [attr.aria-describedby]="descIds('dropoffAddress', 'ride-dropoff')"
                  placeholder="e.g. Two Rivers Mall, Ruaka"
                  (input)="onDropoffInput($event)"
                />
                @if (showErr('dropoffAddress')) {
                  <span id="ride-dropoff-err" class="form-error" role="alert">{{ fieldMsg('dropoffAddress') }}</span>
                }
              </div>
            </div>

            <div class="form-section">
              <h3 class="section-title">Payment</h3>
              <div class="form-group book-field">
                <label for="ride-pay">Method</label>
                <span class="form-hint" id="ride-pay-hint">M-Pesa prompts STK; cash is paid to the rider.</span>
                <select
                  id="ride-pay"
                  formControlName="paymentMethod"
                  class="form-control"
                  [attr.aria-describedby]="'ride-pay-hint'"
                >
                  <option value="MPESA">M-Pesa</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              @if (form.get('paymentMethod')?.value === 'MPESA') {
                <div class="form-group book-field">
                  <label for="ride-mpesa">M-Pesa phone</label>
                  <span class="form-hint" id="ride-mpesa-hint">Number to charge for this ride.</span>
                  <input
                    id="ride-mpesa"
                    formControlName="mpesaPhone"
                    class="form-control"
                    type="tel"
                    inputmode="tel"
                    autocomplete="tel"
                    placeholder="07XXXXXXXX"
                    [attr.aria-invalid]="showErr('mpesaPhone')"
                    [attr.aria-describedby]="descIds('mpesaPhone', 'ride-mpesa')"
                  />
                  @if (showErr('mpesaPhone')) {
                    <span id="ride-mpesa-err" class="form-error" role="alert">{{ fieldMsg('mpesaPhone') }}</span>
                  }
                </div>
              }
            </div>

            @if (estimate()) {
              <div class="estimate-card" role="status">
                <div class="estimate-card__head">
                  <lucide-icon name="wallet" [size]="18"></lucide-icon>
                  <span>Fare preview</span>
                </div>
                <div class="est-row">
                  <span>Distance</span>
                  <strong>{{ estimate()!.distanceKm | number:'1.1-1' }} km</strong>
                </div>
                <div class="est-row">
                  <span>ETA</span>
                  <strong>~{{ estimate()!.estimatedMins }} min</strong>
                </div>
                <div class="est-row est-row--total">
                  <span>Estimated fare</span>
                  <strong class="text-primary">KES {{ estimate()!.estimatedFare | number:'1.0-0' }}</strong>
                </div>
              </div>
            }

            <div class="form-actions-row book-actions">
              <button type="button" class="btn btn--secondary btn--compact" (click)="getEstimate()" [disabled]="estimating()">
                @if (estimating()) { <app-spinner [size]="16" /> } @else { Get estimate }
              </button>
              <button type="submit" class="btn btn--primary btn--full btn--compact"
                [disabled]="loading() || !estimate()">
                @if (loading()) { <app-spinner [size]="18" /> } @else { Confirm booking }
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="book-map-wrap">
        <span class="book-map-label">Map picker</span>
        @if (mapPickMode(); as pickLeg) {
          <div class="book-map-pick-banner" role="status">
            <p>
              @if (pickLeg === 'pickup') {
                Tap the map to set <strong>pickup</strong>
              } @else {
                Tap the map to set <strong>drop-off</strong>
              }
            </p>
            <button type="button" class="btn btn--ghost btn--sm" (click)="cancelMapPick()">Cancel</button>
          </div>
        }
        <app-route-picker-map
          class="book-map"
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
    .book-page {
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
    .book-panel {
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
    .book-hero {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      text-align: left;
    }
    .book-hero__badge {
      flex-shrink: 0;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: linear-gradient(145deg, var(--clr-primary-dark), var(--clr-primary));
      color: #fff;
      box-shadow: 0 6px 18px rgba(64, 138, 113, 0.32);
    }
    .book-hero__title {
      font-family: var(--font-display);
      font-size: clamp(1.2rem, 2.8vw, 1.45rem);
      font-weight: 800;
      color: var(--clr-text);
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin: 0;
    }
    .book-hero__lead {
      font-size: 12px;
      color: var(--clr-text-muted);
      margin: 4px 0 0;
      line-height: 1.4;
      max-width: 36ch;
    }
    .book-hint {
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
    .book-hint__icon { flex-shrink: 0; margin-top: 1px; color: var(--clr-primary-light); opacity: 0.95; }
    .book-form-shell {
      margin: 0;
      max-width: none;
      padding: 0;
      background: transparent;
      border: none;
      box-shadow: none;
    }
    .book-form-shell .form-section:first-of-type { margin-top: 0; padding-top: 0; border-top: none; }
    .book-form-shell .form-section + .form-section { margin-top: 12px; padding-top: 12px; }
    .book-form-shell .section-title { font-size: 10px; letter-spacing: 0.07em; margin-bottom: 2px; }
    .book-field { gap: 3px; }
    .book-field label { font-size: 10px; letter-spacing: 0.06em; }
    .book-field .form-hint {
      font-size: 10px;
      line-height: 1.3;
      color: var(--clr-text-dim);
      margin: 0 0 1px;
    }
    .book-field .form-control {
      padding: 7px 10px;
      font-size: 13px;
      line-height: 1.35;
      border-radius: var(--radius-sm);
      min-height: 36px;
    }
    .book-field select.form-control { min-height: 36px; padding: 6px 10px; }
    .book-field .form-error { font-size: 11px; margin-top: 1px; }
    .book-form-shell .book-actions {
      margin-top: 2px;
      gap: 10px;
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }
    .book-form-shell .book-actions .btn {
      width: 100%;
      min-height: 44px;
      justify-content: center;
    }
    @media (min-width: 480px) {
      .book-form-shell .book-actions {
        flex-direction: row;
        flex-wrap: wrap;
        align-items: stretch;
      }
      .book-form-shell .book-actions .btn {
        width: auto;
        flex: 1;
        min-width: min(100%, 160px);
      }
      .book-form-shell .book-actions .btn--full {
        flex: 1 1 220px;
      }
    }
    .btn--compact { padding: 9px 16px; font-size: 13px; }
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
    .book-locate-row {
      margin: 4px 0 6px;
    }
    .book-locate-row--split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    @media (max-width: 420px) {
      .book-locate-row--split {
        grid-template-columns: 1fr;
      }
    }
    .book-locate-btn {
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
    .book-locate-btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--clr-primary) 14%, transparent);
      border-style: solid;
      color: var(--clr-text);
    }
    .book-locate-btn--active {
      border-style: solid;
      border-color: var(--clr-primary);
      background: color-mix(in srgb, var(--clr-primary) 18%, transparent);
      color: var(--clr-text);
    }
    .book-locate-btn:disabled { opacity: 0.75; }
    .book-map-pick-banner {
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
    .book-map-pick-banner p { margin: 0; text-align: center; }
    .book-map-pick-banner .btn { flex-shrink: 0; }
    .book-map-wrap {
      position: relative;
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: min(320px, 42vh);
      background: var(--clr-bg-elevated);
      overflow: hidden;
      border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    }
    .book-map-label {
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
    .book-map { flex: 1; width: 100%; min-height: 0; }
    @media (min-width: 900px) {
      .book-page {
        flex-direction: row;
        align-items: stretch;
        min-height: calc(100dvh - 200px);
        overflow-x: hidden;
        overflow-y: visible;
      }
      .book-panel {
        width: min(100%, 420px);
        flex-shrink: 0;
        border-bottom: none;
        border-right: 1px solid var(--clr-border);
        overflow: visible;
        max-height: none;
      }
      .book-map-wrap {
        border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
        min-height: 0;
        flex: 1 1 50%;
      }
    }
    @media (max-width: 899px) {
      .book-map-wrap {
        min-height: clamp(240px, 42vh, 360px);
      }
    }
    @supports (height: 100dvh) {
      @media (max-width: 899px) {
        .book-map-wrap {
          min-height: clamp(240px, 42dvh, 360px);
        }
      }
    }
    @media (max-width: 899px) and (orientation: landscape) and (max-height: 520px) {
      .book-map-wrap {
        min-height: clamp(180px, 38vh, 260px);
      }
    }
    @media (max-width: 599px) {
      .book-hero { flex-direction: column; align-items: center; text-align: center; }
      .book-hero__lead { margin-inline: auto; max-width: 100%; }
      .book-hint { font-size: 10px; padding: 8px; }
      .book-map-pick-banner {
        top: 38px;
        padding: 8px 10px;
        font-size: 11px;
        max-width: calc(100% - 16px);
      }
    }
    @media (max-width: 380px) {
      .book-page { border-radius: var(--radius-md); }
      .form-section--accent {
        margin-left: 0;
        margin-right: 0;
        padding-left: 8px;
        padding-right: 8px;
      }
      .book-field .form-control { font-size: 16px; }
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
export class BookRideComponent {
  private readonly fb = inject(FormBuilder);
  private readonly rideService = inject(RideService);
  private readonly mapApi = inject(MapService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly estimating = signal(false);
  protected readonly estimate = signal<{ distanceKm: number; estimatedMins: number; estimatedFare: number } | null>(null);
  protected readonly submitAttempted = signal(false);

  protected readonly pickupPoint = signal<RouteMapPoint | null>(null);
  protected readonly dropoffPoint = signal<RouteMapPoint | null>(null);
  protected readonly locatingPickup = signal(false);
  /** When set, the route map listens for the next tap to place pickup or drop-off. */
  protected readonly mapPickMode = signal<'pickup' | 'dropoff' | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      pickupAddress: ['', Validators.required],
      dropoffAddress: ['', Validators.required],
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
  protected descIds(name: keyof BookRideComponent['form']['value'], base: string): string {
    const hintId = `${base}-hint`;
    if (this.showErr(name)) {
      return `${hintId} ${base}-err`;
    }
    return hintId;
  }

  /** Show inline errors after blur (touch) or after a failed submit. */
  protected showErr(name: keyof BookRideComponent['form']['value']): boolean {
    const c = this.form.get(name);
    return !!c && c.invalid && (c.touched || this.submitAttempted());
  }

  protected fieldMsg(name: keyof BookRideComponent['form']['value']): string {
    const c = this.form.get(name);
    const e = c?.errors;
    if (!e) return '';
    if (e['required']) return 'Required';
    if (e['pattern']) return 'Use a valid Kenyan number (07… or +254…)';
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
          this.toast.success('Drop-off set from map');
        }
      })
      .catch(() => this.toast.error('Could not resolve address for that point'));
  }

  /** GPS → reverse geocode → pickup field + map pin */
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

  protected onPickupInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val.length < 3) return;
    void this.mapApi.geocode(val).then((results) => {
      if (results.length === 0) return;
      const r = results[0];
      this.pickupPoint.set({ lng: r.lng, lat: r.lat });
    });
  }

  protected onDropoffInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val.length < 3) return;
    void this.mapApi.geocode(val).then((results) => {
      if (results.length === 0) return;
      const r = results[0];
      this.dropoffPoint.set({ lng: r.lng, lat: r.lat });
    });
  }

  protected getEstimate(): void {
    this.form.controls.pickupAddress.markAsTouched();
    this.form.controls.dropoffAddress.markAsTouched();
    if (this.form.controls.pickupAddress.invalid || this.form.controls.dropoffAddress.invalid) {
      this.submitAttempted.set(true);
      this.touchHaptic();
      return;
    }
    const pickup = this.pickupPoint();
    const dropoff = this.dropoffPoint();
    if (!pickup || !dropoff) {
      this.toast.warning('Enter both pickup and drop-off addresses first');
      this.touchHaptic();
      return;
    }
    this.estimating.set(true);
    void this.rideService
      .estimate(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng)
      .then((est) => {
        this.estimate.set(est);
        this.estimating.set(false);
      })
      .catch(() => {
        this.toast.error('Could not estimate fare');
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

    void this.rideService
      .create({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: v.pickupAddress,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        dropoffAddress: v.dropoffAddress,
        paymentMethod: v.paymentMethod,
        mpesaPhone: v.mpesaPhone || undefined,
      })
      .then((ride) => {
        this.toast.success('Ride booked! Looking for a nearby rider...');
        void this.router.navigate(['/user/rides', ride.id]);
      })
      .catch((err: { error?: { message?: string } }) => {
        this.toast.error(err.error?.message ?? 'Booking failed');
        this.loading.set(false);
      });
  }
}
