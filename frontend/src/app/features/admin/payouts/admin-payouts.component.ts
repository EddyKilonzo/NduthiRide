import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-admin-payouts',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent, LucideAngularModule],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <lucide-icon name="banknote" [size]="28"></lucide-icon>
          </div>
          <div>
            <h1>Payout Requests</h1>
            <p>Manage and process rider withdrawal requests</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="btn btn--ghost btn--sm" (click)="load()" [disabled]="loading()">
            <lucide-icon name="rotate-cw" [size]="16"></lucide-icon> Refresh
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loader-wrap"><app-spinner /></div>
      } @else if (payouts().length === 0) {
        <div class="empty-state-card card">
          <div class="empty-icon-circle">
            <lucide-icon name="banknote" [size]="48"></lucide-icon>
          </div>
          <h3>No payout requests</h3>
          <p>When riders request to withdraw their earnings, they will appear here.</p>
        </div>
      } @else {
        <div class="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rider</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Requested</th>
                <th>Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (p of payouts(); track p.id) {
                <tr>
                  <td>
                    <div class="rider-cell">
                      <div class="avatar-mini">{{ p.rider.account.fullName.charAt(0) }}</div>
                      <div>
                        <div class="full-name">{{ p.rider.account.fullName }}</div>
                        <div class="phone text-muted mono-xs">{{ p.rider.account.phone }}</div>
                      </div>
                    </div>
                  </td>
                  <td><strong class="text-primary">KES {{ p.amount | number:'1.0-0' }}</strong></td>
                  <td>
                    <div class="method-tag">
                      <lucide-icon [name]="p.method === 'MPESA' ? 'smartphone' : 'banknote'" [size]="12"></lucide-icon>
                      {{ p.method }}
                    </div>
                  </td>
                  <td>{{ p.createdAt | date:'dd MMM, HH:mm' }}</td>
                  <td><span class="badge badge--{{ badge(p.status) }}">{{ p.status }}</span></td>
                  <td>
                    <div class="action-btns">
                      @if (p.status === 'PENDING') {
                        <button class="btn btn--icon btn--success-ghost" title="Approve & Complete" (click)="processPayout(p, 'COMPLETED')">
                          <lucide-icon name="check-circle" [size]="18"></lucide-icon>
                        </button>
                        <button class="btn btn--icon btn--danger-ghost" title="Reject" (click)="processPayout(p, 'REJECTED')">
                          <lucide-icon name="x-circle" [size]="18"></lucide-icon>
                        </button>
                      } @else {
                        <span class="text-muted mono-xs">{{ p.processedAt | date:'shortDate' }}</span>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        
        @if (totalPages() > 1) {
          <div class="pagination">
            <button class="btn btn--secondary btn--sm" (click)="prevPage()" [disabled]="page() === 1">
              <lucide-icon name="chevron-left" [size]="16"></lucide-icon> Prev
            </button>
            <span class="page-info">Page <strong>{{ page() }}</strong> of {{ totalPages() }}</span>
            <button class="btn btn--secondary btn--sm" (click)="nextPage()" [disabled]="page() === totalPages()">
              Next <lucide-icon name="chevron-right" [size]="16"></lucide-icon>
            </button>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .header-content { display: flex; align-items: center; gap: 16px; }
    .header-icon {
      width: 48px; height: 48px; border-radius: var(--radius-md);
      background: var(--clr-bg-elevated); color: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      box-shadow: var(--shadow-sm);
    }
    .loader-wrap { display: flex; justify-content: center; padding: 80px; }
    .table-wrapper { overflow-x: auto; border: none; }
    .rider-cell { display: flex; align-items: center; gap: 12px; }
    .avatar-mini {
      width: 32px; height: 32px; border-radius: 50%; background: var(--clr-bg-elevated);
      color: var(--clr-primary); display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; border: 1px solid var(--clr-border);
    }
    .full-name { font-weight: 600; font-size: 14px; }
    .method-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; }
    .action-btns { display: flex; gap: 4px; justify-content: flex-end; }
    .btn--icon {
      width: 36px; height: 36px; padding: 0; border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center; color: var(--clr-text-muted);
      &:hover { background: var(--clr-bg-elevated); color: var(--clr-text); }
    }
    .btn--success-ghost:hover { color: var(--clr-success) !important; background: rgba(34,197,94,.1) !important; }
    .btn--danger-ghost:hover { color: var(--clr-error) !important; background: rgba(239,68,68,.1) !important; }
    .text-right { text-align: right; }
    .mono-xs { font-family: var(--font-mono, monospace); font-size: 11px; }
    .empty-state-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 60px 40px; text-align: center; gap: 16px;
    }
    .empty-icon-circle {
      width: 80px; height: 80px; border-radius: 50%; background: var(--clr-bg-elevated);
      display: flex; align-items: center; justify-content: center; color: var(--clr-primary);
      opacity: 0.8; margin-bottom: 8px;
    }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 32px; }
    .page-info { font-size: 14px; color: var(--clr-text-muted); }
  `],
})
export class AdminPayoutsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  protected readonly payouts = signal<any[]>([]);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.adminService.listPayouts(this.page(), 20);
      this.payouts.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch {
      this.toast.error('Failed to load payouts');
    } finally {
      this.loading.set(false);
    }
  }

  async processPayout(payout: any, status: string): Promise<void> {
    const ref = status === 'COMPLETED' ? prompt('Enter transaction reference (optional):') : undefined;
    try {
      await this.adminService.updatePayoutStatus(payout.id, status, ref || undefined);
      this.toast.success(`Payout ${status.toLowerCase()}`);
      await this.load();
    } catch {
      this.toast.error('Failed to update payout');
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  protected badge(status: string): string {
    const m: Record<string, string> = { PENDING: 'pending', COMPLETED: 'active', REJECTED: 'closed' };
    return m[status] ?? 'info';
  }
}
