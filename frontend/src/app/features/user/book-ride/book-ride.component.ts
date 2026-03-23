import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import mapboxgl from 'mapbox-gl';
import { AuthService } from '../../../core/services/auth.service';
import { RideService } from '../../../core/services/ride.service';
import { MapService } from '../../../core/services/map.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-book-ride',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SpinnerComponent],
  template: `
    <div class="book-page">
      <!-- Left panel -->
      <div class="book-panel">
        <h1 class="panel-title">Book a Ride</h1>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-group">
            <label>Pickup Location</label>
            <input formControlName="pickupAddress" class="form-control"
              placeholder="Enter pickup address" (input)="onPickupInput($event)" />
          </div>

          <div class="form-group">
            <label>Drop-off Location</label>
            <input formControlName="dropoffAddress" class="form-control"
              placeholder="Enter drop-off address" (input)="onDropoffInput($event)" />
          </div>

          <div class="form-group">
            <label>Payment Method</label>
            <select formControlName="paymentMethod" class="form-control">
              <option value="MPESA">M-Pesa</option>
              <option value="CASH">Cash</option>
            </select>
          </div>

          @if (form.get('paymentMethod')?.value === 'MPESA') {
            <div class="form-group">
              <label>M-Pesa Phone</label>
              <input formControlName="mpesaPhone" class="form-control" type="tel" placeholder="07XXXXXXXX" />
            </div>
          }

          <!-- Estimate -->
          @if (estimate()) {
            <div class="estimate-card">
              <div class="est-row">
                <span>Distance</span>
                <strong>{{ estimate()!.distanceKm | number:'1.1-1' }} km</strong>
              </div>
              <div class="est-row">
                <span>ETA</span>
                <strong>~{{ estimate()!.estimatedMins }} min</strong>
              </div>
              <div class="est-row est-row--total">
                <span>Estimated Fare</span>
                <strong class="text-primary">KES {{ estimate()!.estimatedFare | number:'1.0-0' }}</strong>
              </div>
            </div>
          }

          <div class="form-actions">
            <button type="button" class="btn btn--secondary" (click)="getEstimate()" [disabled]="estimating()">
              @if (estimating()) { <app-spinner [size]="16" /> } @else { Get Estimate }
            </button>
            <button type="submit" class="btn btn--primary btn--full"
              [disabled]="loading() || form.invalid || !estimate()">
              @if (loading()) { <app-spinner [size]="18" /> } @else { Confirm Booking }
            </button>
          </div>
        </form>
      </div>

      <!-- Map -->
      <div class="map-container" #mapContainer></div>
    </div>
  `,
  styles: [`
    .book-page { display: flex; height: calc(100vh - 64px); gap: 0; margin: -32px; }
    .book-panel { width: 380px; flex-shrink: 0; padding: 32px 24px; overflow-y: auto; background: var(--clr-bg-card); border-right: 1px solid var(--clr-border); display: flex; flex-direction: column; gap: 16px; }
    .panel-title { font-size: 20px; font-weight: 700; }
    .map-container { flex: 1; }
    .estimate-card { background: var(--clr-bg-elevated); border: 1px solid var(--clr-border); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .est-row { display: flex; justify-content: space-between; font-size: 14px; color: var(--clr-text-muted); }
    .est-row--total { font-size: 16px; padding-top: 10px; border-top: 1px solid var(--clr-border); color: var(--clr-text); }
    .form-actions { display: flex; flex-direction: column; gap: 10px; }
  `],
})
export class BookRideComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer') mapRef!: ElementRef<HTMLDivElement>;

  private readonly fb          = inject(FormBuilder);
  private readonly rideService = inject(RideService);
  private readonly mapApi      = inject(MapService);
  private readonly toast       = inject(ToastService);
  private readonly auth        = inject(AuthService);
  private readonly router      = inject(Router);

  protected readonly loading   = signal(false);
  protected readonly estimating = signal(false);
  protected readonly estimate  = signal<{ distanceKm: number; estimatedMins: number; estimatedFare: number } | null>(null);

  private map!: mapboxgl.Map;
  private pickupMarker: mapboxgl.Marker | null = null;
  private dropoffMarker: mapboxgl.Marker | null = null;

  // Hidden coordinate fields fed from geocoding
  private pickupCoords: [number, number] | null = null;
  private dropoffCoords: [number, number] | null = null;

  protected readonly form = this.fb.nonNullable.group({
    pickupAddress:  ['', Validators.required],
    dropoffAddress: ['', Validators.required],
    paymentMethod:  ['MPESA' as 'MPESA' | 'CASH', Validators.required],
    mpesaPhone:     [''],
  });

  ngOnInit(): void {
    (mapboxgl as unknown as { accessToken: string }).accessToken = environment.mapboxToken;
  }

  ngAfterViewInit(): void {
    this.map = new mapboxgl.Map({
      container: this.mapRef.nativeElement,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [36.8219, -1.2921], // Nairobi
      zoom: 12,
    });
    this.map.addControl(new mapboxgl.NavigationControl());
  }

  protected onPickupInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val.length < 3) return;
    void this.mapApi.geocode(val).then((results) => {
      if (results.length === 0) return;
      const r = results[0];
      this.pickupCoords = [r.lng, r.lat];
      this.updateMarker('pickup', r.lng, r.lat);
    });
  }

  protected onDropoffInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val.length < 3) return;
    void this.mapApi.geocode(val).then((results) => {
      if (results.length === 0) return;
      const r = results[0];
      this.dropoffCoords = [r.lng, r.lat];
      this.updateMarker('dropoff', r.lng, r.lat);
    });
  }

  protected getEstimate(): void {
    if (!this.pickupCoords || !this.dropoffCoords) {
      this.toast.warning('Enter both pickup and drop-off addresses first');
      return;
    }
    this.estimating.set(true);
    const [pLng, pLat] = this.pickupCoords;
    const [dLng, dLat] = this.dropoffCoords;
    void this.rideService.estimate(pLat, pLng, dLat, dLng).then(
      (est) => { this.estimate.set(est); this.estimating.set(false); },
    ).catch(() => { this.toast.error('Could not estimate fare'); this.estimating.set(false); });
  }

  protected submit(): void {
    if (this.form.invalid || this.loading() || !this.pickupCoords || !this.dropoffCoords) return;
    this.loading.set(true);

    const v = this.form.getRawValue();
    const [pLng, pLat] = this.pickupCoords;
    const [dLng, dLat] = this.dropoffCoords;

    void this.rideService.create({
      pickupLat: pLat, pickupLng: pLng, pickupAddress: v.pickupAddress,
      dropoffLat: dLat, dropoffLng: dLng, dropoffAddress: v.dropoffAddress,
      paymentMethod: v.paymentMethod,
      mpesaPhone: v.mpesaPhone || undefined,
    }).then((ride) => {
      this.toast.success('Ride booked! Looking for a nearby rider...');
      void this.router.navigate(['/user/rides', ride.id]);
    }).catch((err: { error?: { message?: string } }) => {
      this.toast.error(err.error?.message ?? 'Booking failed');
      this.loading.set(false);
    });
  }

  private updateMarker(type: 'pickup' | 'dropoff', lng: number, lat: number): void {
    const el = document.createElement('div');
    el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${type === 'pickup' ? '#FF6B00' : '#22C55E'};border:2px solid white;`;

    if (type === 'pickup') {
      this.pickupMarker?.remove();
      this.pickupMarker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(this.map);
    } else {
      this.dropoffMarker?.remove();
      this.dropoffMarker = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(this.map);
    }

    if (this.pickupMarker && this.dropoffMarker) {
      const bounds = new mapboxgl.LngLatBounds(
        this.pickupMarker.getLngLat(), this.dropoffMarker.getLngLat()
      );
      this.map.fitBounds(bounds, { padding: 80 });
    } else {
      this.map.flyTo({ center: [lng, lat], zoom: 14 });
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
