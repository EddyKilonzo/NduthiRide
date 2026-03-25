import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { RideService } from '../../../core/services/ride.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride } from '../../../core/models/ride.models';

@Component({
  selector: 'app-my-rides',
  standalone: true,
  imports: [CommonModule, RouterLink, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div><h1>My Rides</h1><p>Full history of your bookings</p></div>
        <a [routerLink]="['/user/book-ride']" class="btn btn--primary btn--sm">+ Book Ride</a>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (rides().length === 0) {
        <div class="empty-state">
          <div class="empty-illu" aria-hidden="true"><lucide-icon name="bike" [size]="44"></lucide-icon></div>
          <h3>No rides yet</h3>
          <p>Your ride history will appear here</p>
        </div>
      } @else {
        <div class="card table-wrapper data-card">
          <table>
            <thead>
              <tr>
                <th>From</th><th>To</th><th>Status</th>
                <th>Fare</th><th>Date</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (ride of rides(); track ride.id) {
                <tr>
                  <td class="addr">{{ ride.pickupAddress }}</td>
                  <td class="addr">{{ ride.dropoffAddress }}</td>
                  <td><span class="badge badge--{{ badge(ride.status) }}">{{ ride.status }}</span></td>
                  <td>KES {{ ride.estimatedFare | number:'1.0-0' }}</td>
                  <td>{{ ride.createdAt | date:'dd MMM, HH:mm' }}</td>
                  <td><a [routerLink]="['/user/rides', ride.id]" class="btn btn--ghost btn--sm">View</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="pagination">
            <button class="btn btn--secondary btn--sm" (click)="prevPage()" [disabled]="page() === 1"><lucide-icon name="chevron-left" [size]="16"></lucide-icon> Prev</button>
            <span class="text-muted">Page {{ page() }} of {{ totalPages() }}</span>
            <button class="btn btn--secondary btn--sm" (click)="nextPage()" [disabled]="page() === totalPages()">Next <lucide-icon name="chevron-right" [size]="16"></lucide-icon></button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .data-card { box-shadow: var(--shadow-card); padding: 0; overflow: hidden; }
    .empty-illu { display: flex; justify-content: center; color: var(--clr-text-dim); opacity: 0.45; margin-bottom: 8px; }
    .addr { max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; flex-wrap: wrap; }
  `],
})
export class MyRidesComponent implements OnInit {
  private readonly rideService = inject(RideService);

  protected readonly rides      = signal<Ride[]>([]);
  protected readonly loading    = signal(true);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.loading.set(true);
    void this.rideService.getMyRides(this.page(), 15).then((res) => {
      this.rides.set(res.data);
      this.totalPages.set(res.totalPages);
      this.loading.set(false);
    }).catch(() => this.loading.set(false));
  }

  protected prevPage(): void { this.page.update((p) => p - 1); this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); this.load(); }

  protected badge(status: string): string {
    const map: Record<string,string> = { PENDING:'pending', COMPLETED:'active', CANCELLED:'closed' };
    return map[status] ?? 'info';
  }
}
