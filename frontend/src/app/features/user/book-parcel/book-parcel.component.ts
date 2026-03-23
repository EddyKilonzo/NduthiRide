import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ParcelService } from '../../../core/services/parcel.service';
import { MapService } from '../../../core/services/map.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-book-parcel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SpinnerComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>Send a Parcel</h1><p>Same-day delivery across the city</p></div>
      </div>

      <div class="form-layout">
        <form [formGroup]="form" (ngSubmit)="submit()">
          <!-- Item details -->
          <div class="card form-section">
            <h3 class="section-title">Item Details</h3>
            <div class="form-group">
              <label>Item Description</label>
              <input formControlName="itemDescription" class="form-control" placeholder="e.g. Electronics — fragile laptop" />
            </div>
            <div class="form-group">
              <label>Weight (kg)</label>
              <input formControlName="weightKg" class="form-control" type="number" min="0.1" step="0.1" placeholder="1.5" />
            </div>
          </div>

          <!-- Pickup -->
          <div class="card form-section">
            <h3 class="section-title">Pickup Location</h3>
            <div class="form-group">
              <label>Address</label>
              <input formControlName="pickupAddress" class="form-control" placeholder="Enter pickup address"
                (input)="geocode($event, 'pickup')" />
            </div>
          </div>

          <!-- Dropoff -->
          <div class="card form-section">
            <h3 class="section-title">Delivery Location</h3>
            <div class="form-group">
              <label>Address</label>
              <input formControlName="dropoffAddress" class="form-control" placeholder="Enter delivery address"
                (input)="geocode($event, 'dropoff')" />
            </div>
            <div class="form-group">
              <label>Recipient Name</label>
              <input formControlName="recipientName" class="form-control" placeholder="Peter Ochieng" />
            </div>
            <div class="form-group">
              <label>Recipient Phone</label>
              <input formControlName="recipientPhone" class="form-control" type="tel" placeholder="07XXXXXXXX" />
            </div>
          </div>

          <!-- Payment -->
          <div class="card form-section">
            <h3 class="section-title">Payment</h3>
            <div class="form-group">
              <label>Method</label>
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
          </div>

          <!-- Estimate -->
          @if (feeEstimate()) {
            <div class="estimate-card card">
              <div class="est-row"><span>Distance</span><strong>{{ feeEstimate()!.distanceKm | number:'1.1-1' }} km</strong></div>
              <div class="est-row est-row--total"><span>Delivery Fee</span><strong class="text-primary">KES {{ feeEstimate()!.deliveryFee | number:'1.0-0' }}</strong></div>
            </div>
          }

          <div class="form-row">
            <button type="button" class="btn btn--secondary" (click)="getEstimate()" [disabled]="estimating()">
              @if (estimating()) { <app-spinner [size]="16" /> } @else { Get Fee Estimate }
            </button>
            <button type="submit" class="btn btn--primary btn--full" [disabled]="loading() || form.invalid">
              @if (loading()) { <app-spinner [size]="18" /> } @else { Place Order }
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .form-layout { max-width: 600px; display: flex; flex-direction: column; gap: 16px; }
    .form-section { display: flex; flex-direction: column; gap: 14px; }
    .section-title { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
    .estimate-card { display: flex; flex-direction: column; gap: 8px; }
    .est-row { display: flex; justify-content: space-between; font-size: 14px; color: var(--clr-text-muted); }
    .est-row--total { font-size: 16px; padding-top: 8px; border-top: 1px solid var(--clr-border); color: var(--clr-text); }
    .form-row { display: flex; gap: 12px; }
  `],
})
export class BookParcelComponent {
  private readonly fb            = inject(FormBuilder);
  private readonly parcelService = inject(ParcelService);
  private readonly mapApi        = inject(MapService);
  private readonly toast         = inject(ToastService);
  private readonly router        = inject(Router);

  protected readonly loading     = signal(false);
  protected readonly estimating  = signal(false);
  protected readonly feeEstimate = signal<{ deliveryFee: number; distanceKm: number } | null>(null);

  private pickupCoords:  [number, number] | null = null;
  private dropoffCoords: [number, number] | null = null;

  protected readonly form = this.fb.nonNullable.group({
    itemDescription: ['', Validators.required],
    weightKg:        [1, [Validators.required, Validators.min(0.1)]],
    pickupAddress:   ['', Validators.required],
    dropoffAddress:  ['', Validators.required],
    recipientName:   ['', Validators.required],
    recipientPhone:  ['', [Validators.required, Validators.pattern(/^(\+254|0)(7|1)\d{8}$/)]],
    paymentMethod:   ['MPESA' as 'MPESA' | 'CASH', Validators.required],
    mpesaPhone:      [''],
  });

  protected geocode(event: Event, type: 'pickup' | 'dropoff'): void {
    const val = (event.target as HTMLInputElement).value;
    if (val.length < 3) return;
    void this.mapApi.geocode(val).then((res) => {
      if (res.length === 0) return;
      const coords: [number, number] = [res[0].lng, res[0].lat];
      if (type === 'pickup') this.pickupCoords = coords;
      else this.dropoffCoords = coords;
    });
  }

  protected getEstimate(): void {
    if (!this.pickupCoords || !this.dropoffCoords) {
      this.toast.warning('Enter both pickup and delivery addresses first');
      return;
    }
    this.estimating.set(true);
    const [pLng, pLat] = this.pickupCoords;
    const [dLng, dLat] = this.dropoffCoords;
    const { weightKg } = this.form.getRawValue();
    void this.parcelService.estimate({ pickupLat: pLat, pickupLng: pLng, dropoffLat: dLat, dropoffLng: dLng, weightKg }).then(
      (res) => { this.feeEstimate.set(res); this.estimating.set(false); },
    ).catch(() => { this.toast.error('Estimate failed'); this.estimating.set(false); });
  }

  protected submit(): void {
    if (this.form.invalid || this.loading() || !this.pickupCoords || !this.dropoffCoords) return;
    this.loading.set(true);
    const v = this.form.getRawValue();
    const [pLng, pLat] = this.pickupCoords;
    const [dLng, dLat] = this.dropoffCoords;

    void this.parcelService.create({
      pickupLat: pLat, pickupLng: pLng, pickupAddress: v.pickupAddress,
      dropoffLat: dLat, dropoffLng: dLng, dropoffAddress: v.dropoffAddress,
      itemDescription: v.itemDescription, weightKg: v.weightKg,
      recipientName: v.recipientName, recipientPhone: v.recipientPhone,
      paymentMethod: v.paymentMethod, mpesaPhone: v.mpesaPhone || undefined,
    }).then((parcel) => {
      this.toast.success('Parcel order placed! Looking for a nearby rider...');
      void this.router.navigate(['/user/parcels', parcel.id]);
    }).catch((err: { error?: { message?: string } }) => {
      this.toast.error(err.error?.message ?? 'Order failed');
      this.loading.set(false);
    });
  }
}
