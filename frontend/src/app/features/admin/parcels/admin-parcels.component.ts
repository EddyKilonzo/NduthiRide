import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Parcel } from '../../../core/models/parcel.models';

@Component({
  selector: 'app-admin-parcels',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>Parcels</h1><p>All delivery bookings on the platform</p></div>
      </div>

      <div class="filters card">
        <select [(ngModel)]="statusFilter" (change)="load()">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="PICKED_UP">Picked Up</option>
          <option value="IN_TRANSIT">In Transit</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (parcels().length === 0) {
        <div class="empty-state"><h3>No parcels found</h3></div>
      } @else {
        <div class="card table-wrapper">
          <table>
            <thead>
              <tr><th>ID</th><th>Item</th><th>Recipient</th><th>Status</th><th>Fee</th><th>Date</th></tr>
            </thead>
            <tbody>
              @for (p of parcels(); track p.id) {
                <tr>
                  <td class="mono">{{ p.id.slice(0,8) }}…</td>
                  <td class="addr">{{ p.itemDescription }}</td>
                  <td>{{ p.recipientName }}</td>
                  <td><span class="badge badge--{{ badge(p.status) }}">{{ p.status }}</span></td>
                  <td>KES {{ p.deliveryFee | number:'1.0-0' }}</td>
                  <td>{{ p.createdAt | date:'dd MMM, HH:mm' }}</td>
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
    .addr { max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mono { font-family: monospace; font-size: 13px; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
  `],
})
export class AdminParcelsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  protected readonly parcels    = signal<Parcel[]>([]);
  protected readonly loading    = signal(true);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);
  protected statusFilter = '';

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.adminService.listParcels(this.page(), 20, this.statusFilter || undefined);
      this.parcels.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  protected badge(status: string): string {
    const m: Record<string, string> = { DELIVERED: 'active', CANCELLED: 'closed', IN_TRANSIT: 'info', PENDING: 'pending' };
    return m[status] ?? 'info';
  }
}
