import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RideService }   from '../../../core/services/ride.service';
import { ParcelService } from '../../../core/services/parcel.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride }   from '../../../core/models/ride.models';
import type { Parcel } from '../../../core/models/parcel.models';

@Component({
  selector: 'app-rider-earnings',
  standalone: true,
  imports: [CommonModule, SpinnerComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>Earnings</h1><p>Track your income from rides and deliveries</p></div>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else {
        <!-- Summary cards -->
        <div class="stats-grid">
          <div class="card stat-card">
            <p class="stat-label">Total Rides</p>
            <p class="stat-value">{{ rides().length }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Total Deliveries</p>
            <p class="stat-value">{{ parcels().length }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Gross Earnings</p>
            <p class="stat-value primary">KES {{ grossEarnings() | number:'1.0-0' }}</p>
          </div>
          <div class="card stat-card">
            <p class="stat-label">Est. Payout (85%)</p>
            <p class="stat-value success">KES {{ estimatedPayout() | number:'1.0-0' }}</p>
          </div>
        </div>

        <!-- Note -->
        <div class="card note-card">
          <p>💡 Platform commission is 15% of each transaction. Payouts are sent to your M-Pesa after each completed trip.</p>
        </div>

        <!-- Recent transactions -->
        <div class="card">
          <h3 class="card-title">Recent Transactions</h3>
          @if (rides().length === 0 && parcels().length === 0) {
            <p class="text-muted">No completed trips yet.</p>
          } @else {
            <table>
              <thead>
                <tr><th>Type</th><th>Route / Item</th><th>Gross</th><th>Your Cut</th><th>Date</th></tr>
              </thead>
              <tbody>
                @for (r of rides(); track r.id) {
                  <tr>
                    <td><span class="type-badge ride">Ride</span></td>
                    <td class="addr">{{ r.pickupAddress }} → {{ r.dropoffAddress }}</td>
                    <td>KES {{ r.estimatedFare | number:'1.0-0' }}</td>
                    <td class="payout">KES {{ r.estimatedFare * 0.85 | number:'1.0-0' }}</td>
                    <td>{{ r.createdAt | date:'dd MMM' }}</td>
                  </tr>
                }
                @for (p of parcels(); track p.id) {
                  <tr>
                    <td><span class="type-badge parcel">Parcel</span></td>
                    <td class="addr">{{ p.itemDescription }}</td>
                    <td>KES {{ p.deliveryFee | number:'1.0-0' }}</td>
                    <td class="payout">KES {{ p.deliveryFee * 0.85 | number:'1.0-0' }}</td>
                    <td>{{ p.createdAt | date:'dd MMM' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 20px; }
    .stat-card  { text-align: center; padding: 24px 16px; }
    .stat-label { font-size: 12px; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-value.primary { color: var(--clr-primary); }
    .stat-value.success { color: var(--clr-success); }
    .card-title { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 16px; }
    .note-card  { background: rgba(255,107,0,.06); border: 1px solid rgba(255,107,0,.2); font-size: 14px; color: var(--clr-text-muted); margin-bottom: 20px; }
    .addr       { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .payout     { color: var(--clr-success); font-weight: 600; }
    .type-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .type-badge.ride   { background: rgba(255,107,0,.15); color: var(--clr-primary); }
    .type-badge.parcel { background: rgba(0,200,150,.15); color: var(--clr-success); }
  `],
})
export class RiderEarningsComponent implements OnInit {
  private readonly rideService   = inject(RideService);
  private readonly parcelService = inject(ParcelService);

  protected readonly loading  = signal(true);
  protected readonly rides    = signal<Ride[]>([]);
  protected readonly parcels  = signal<Parcel[]>([]);

  protected readonly grossEarnings   = computed(() =>
    this.rides().reduce((s, r) => s + r.estimatedFare, 0) +
    this.parcels().reduce((s, p) => s + p.deliveryFee, 0),
  );
  protected readonly estimatedPayout = computed(() => this.grossEarnings() * 0.85);

  async ngOnInit(): Promise<void> {
    try {
      const [rideRes, parcelRes] = await Promise.all([
        this.rideService.getMyRides(1, 50, 'COMPLETED'),
        this.parcelService.getMyParcels(1, 50, 'DELIVERED'),
      ]);
      this.rides.set(rideRes.data);
      this.parcels.set(parcelRes.data);
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }
}
