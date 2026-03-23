import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { Payment } from '../../../core/models/payment.models';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>Payments</h1><p>M-Pesa transaction log</p></div>
      </div>

      <div class="filters card">
        <select [(ngModel)]="statusFilter" (change)="load()">
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
        <select [(ngModel)]="methodFilter" (change)="load()">
          <option value="">All Methods</option>
          <option value="MPESA">M-Pesa</option>
          <option value="CASH">Cash</option>
        </select>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (payments().length === 0) {
        <div class="empty-state"><h3>No payments found</h3></div>
      } @else {
        <div class="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Method</th><th>Amount</th><th>Status</th>
                <th>M-Pesa Receipt</th><th>Payer</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              @for (p of payments(); track p.id) {
                <tr>
                  <td class="mono">{{ p.id.slice(0,8) }}…</td>
                  <td>{{ p.method }}</td>
                  <td><strong>KES {{ p.amount | number:'1.0-0' }}</strong></td>
                  <td><span class="badge badge--{{ badge(p.status) }}">{{ p.status }}</span></td>
                  <td class="mono">{{ p.mpesaReceiptNumber ?? '—' }}</td>
                  <td>{{ p.mpesaPhone ?? '—' }}</td>
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
    .mono { font-family: monospace; font-size: 13px; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
  `],
})
export class AdminPaymentsComponent implements OnInit {
  private readonly adminService = inject(AdminService);

  protected readonly payments   = signal<Payment[]>([]);
  protected readonly loading    = signal(true);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);

  protected statusFilter = '';
  protected methodFilter = '';

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.adminService.listPayments(
        this.page(), 20,
        this.statusFilter || undefined,
        this.methodFilter || undefined,
      );
      this.payments.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  protected badge(status: string): string {
    const m: Record<string, string> = { COMPLETED: 'active', FAILED: 'closed', PROCESSING: 'info', PENDING: 'pending' };
    return m[status] ?? 'info';
  }
}
