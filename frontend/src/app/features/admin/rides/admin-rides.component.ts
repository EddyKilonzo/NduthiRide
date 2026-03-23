import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Ride } from '../../../core/models/ride.models';

@Component({
  selector: 'app-admin-rides',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>Rides</h1><p>All ride bookings on the platform</p></div>
      </div>

      <div class="filters card">
        <select [(ngModel)]="statusFilter" (change)="load()">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (rides().length === 0) {
        <div class="empty-state"><h3>No rides found</h3></div>
      } @else {
        <div class="card table-wrapper">
          <table>
            <thead>
              <tr><th>ID</th><th>Pickup</th><th>Drop-off</th><th>Status</th><th>Fare</th><th>Date</th></tr>
            </thead>
            <tbody>
              @for (r of rides(); track r.id) {
                <tr>
                  <td class="mono">{{ r.id.slice(0,8) }}…</td>
                  <td class="addr">{{ r.pickupAddress }}</td>
                  <td class="addr">{{ r.dropoffAddress }}</td>
                  <td><span class="badge badge--{{ badge(r.status) }}">{{ r.status }}</span></td>
                  <td>KES {{ r.estimatedFare | number:'1.0-0' }}</td>
                  <td>{{ r.createdAt | date:'dd MMM, HH:mm' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (totalPages() > 1) {
          <div class="pagination">
            <button class="btn btn--secondary btn--sm" (click)="prevPage()" [disabled]="page() === 1">← Prev</button>
            <span class="text-muted">Page {{ page() }} of {{ totalPages() }}</span>
            <button class="btn btn--secondary btn--sm" (click)="nextPage()" [disabled]="page() === totalPages()">Next →</button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .filters { display: flex; gap: 12px; margin-bottom: 20px; padding: 12px 16px; }
    .filters select { padding: 8px 12px; border: 1px solid var(--clr-border); border-radius: var(--radius-md); background: var(--clr-bg); color: var(--clr-text); font-size: 14px; }
    .addr  { max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mono  { font-family: monospace; font-size: 13px; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
  `],
})
export class AdminRidesComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  protected readonly rides      = signal<Ride[]>([]);
  protected readonly loading    = signal(true);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);
  protected statusFilter = '';

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.adminService.listRides(this.page(), 20, this.statusFilter || undefined);
      this.rides.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  protected badge(status: string): string {
    const m: Record<string, string> = { COMPLETED: 'active', CANCELLED: 'closed', IN_PROGRESS: 'info', PENDING: 'pending' };
    return m[status] ?? 'info';
  }
}
