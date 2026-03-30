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
        <div class="rides-grid">
          @for (ride of rides(); track ride.id) {
            <div class="card ride-card" [routerLink]="['/user/rides', ride.id]">
              <div class="ride-card__header">
                <span class="badge badge--{{ badge(ride.status) }}">{{ ride.status }}</span>
                <span class="ride-card__date">{{ ride.createdAt | date:'dd MMM, HH:mm' }}</span>
              </div>
              
              <div class="ride-card__route">
                <div class="route-item">
                  <div class="route-marker route-marker--pickup"></div>
                  <div class="route-address">{{ ride.pickupAddress }}</div>
                </div>
                <div class="route-line"></div>
                <div class="route-item">
                  <div class="route-marker route-marker--dropoff"></div>
                  <div class="route-address">{{ ride.dropoffAddress }}</div>
                </div>
              </div>

              <div class="ride-card__footer">
                <div class="ride-card__fare">KES {{ ride.estimatedFare | number:'1.0-0' }}</div>
                <div class="ride-card__action">
                  <span>View Details</span>
                  <lucide-icon name="chevron-right" [size]="16"></lucide-icon>
                </div>
              </div>
            </div>
          }
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
    .rides-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
      gap: 20px; 
    }
    .ride-card { 
      padding: 16px; 
      cursor: pointer; 
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 16px;
      border: 1px solid var(--clr-border);
      box-shadow: rgba(50, 50, 93, 0.25) 0px 50px 100px -20px, rgba(0, 0, 0, 0.3) 0px 30px 60px -30px, rgba(10, 37, 64, 0.35) 0px -2px 6px 0px inset;
    }
    .ride-card:hover { 
      transform: translateY(-4px); 
      box-shadow: var(--shadow-lg); 
      border-color: var(--clr-primary);
    }
    .ride-card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .ride-card__date {
      font-size: 0.85rem;
      color: var(--clr-text-dim);
    }
    .ride-card__route {
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
    }
    .route-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .route-marker {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-top: 5px;
      flex-shrink: 0;
    }
    .route-marker--pickup { background: #F59E0B; }
    .route-marker--dropoff { background: #22C55E; }
    .route-line {
      position: absolute;
      left: 4.5px;
      top: 15px;
      bottom: 15px;
      width: 1px;
      border-left: 1px dashed var(--clr-border);
    }
    .route-address {
      font-size: 0.9rem;
      color: var(--clr-text);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .ride-card__footer {
      margin-top: auto;
      padding-top: 12px;
      border-top: 1px solid var(--clr-border-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .ride-card__fare {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--clr-primary);
    }
    .ride-card__action {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--clr-text-dim);
    }
    .empty-illu { display: flex; justify-content: center; color: var(--clr-text-dim); opacity: 0.45; margin-bottom: 8px; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 32px; flex-wrap: wrap; }
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
