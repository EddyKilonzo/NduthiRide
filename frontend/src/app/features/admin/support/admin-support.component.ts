import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, SpinnerComponent],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <lucide-icon name="help-circle" [size]="28"></lucide-icon>
          </div>
          <div>
            <h1>Support Tickets</h1>
            <p>Review and resolve user and rider inquiries</p>
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
      } @else if (tickets().length === 0) {
        <div class="empty-state card">
          <div class="empty-icon-circle">
            <lucide-icon name="message-square" [size]="48"></lucide-icon>
          </div>
          <h3>No support tickets</h3>
          <p>Tickets submitted by users and riders will appear here.</p>
        </div>
      } @else {
        <div class="tickets-list">
          @for (t of tickets(); track t.id) {
            <div class="ticket-card card modern-shadow" [class.closed]="t.status === 'CLOSED'">
              <div class="ticket-header">
                <div class="user-info">
                  <div class="avatar-mini">{{ t.account.fullName.charAt(0) }}</div>
                  <div class="user-details">
                    <span class="full-name">{{ t.account.fullName }}</span>
                    <span class="role-tag">{{ t.account.role }}</span>
                  </div>
                </div>
                <div class="ticket-meta">
                  <span class="badge badge--{{ priorityBadge(t.priority) }}">{{ t.priority }}</span>
                  <span class="badge badge--{{ statusBadge(t.status) }}">{{ t.status }}</span>
                </div>
              </div>

              <div class="ticket-body">
                <h3 class="subject">{{ t.subject }}</h3>
                <p class="message">{{ t.message }}</p>
                <div class="date-info">
                  <lucide-icon name="clock" [size]="12"></lucide-icon>
                  {{ t.createdAt | date:'dd MMM yyyy, HH:mm' }}
                </div>
              </div>

              <div class="ticket-actions">
                @if (t.status !== 'CLOSED') {
                  <button class="btn btn--success-ghost btn--sm" (click)="updateStatus(t, 'CLOSED')">
                    <lucide-icon name="check-circle" [size]="16"></lucide-icon> Resolve & Close
                  </button>
                  @if (t.status === 'OPEN') {
                    <button class="btn btn--info-ghost btn--sm" (click)="updateStatus(t, 'IN_PROGRESS')">
                      In Progress
                    </button>
                  }
                } @else {
                  <span class="resolved-text">
                    <lucide-icon name="check" [size]="14"></lucide-icon> Resolved
                  </span>
                }
              </div>
            </div>
          }
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
    .tickets-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 20px; margin-top: 24px; }
    @media (max-width: 600px) { .tickets-list { grid-template-columns: 1fr; } }

    .ticket-card { display: flex; flex-direction: column; gap: 16px; padding: 20px; transition: all 0.2s; }
    .ticket-card.closed { opacity: 0.8; }
    .ticket-header { display: flex; justify-content: space-between; align-items: center; }
    .user-info { display: flex; align-items: center; gap: 12px; }
    .avatar-mini {
      width: 32px; height: 32px; border-radius: 50%; background: var(--clr-bg-elevated);
      color: var(--clr-primary); display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; border: 1px solid var(--clr-border);
    }
    .user-details { display: flex; flex-direction: column; }
    .full-name { font-size: 14px; font-weight: 600; }
    .role-tag { font-size: 10px; text-transform: uppercase; color: var(--clr-text-muted); letter-spacing: 0.5px; }
    .ticket-meta { display: flex; gap: 8px; }

    .ticket-body { flex: 1; }
    .subject { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: var(--clr-text); }
    .message { font-size: 14px; color: var(--clr-text-muted); line-height: 1.5; margin: 0 0 12px; }
    .date-info { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--clr-text-dim); }

    .ticket-actions { display: flex; gap: 10px; padding-top: 16px; border-top: 1px solid var(--clr-border); }
    .btn--success-ghost { color: var(--clr-success); background: rgba(34,197,94,.1); &:hover { background: rgba(34,197,94,.2); } }
    .btn--info-ghost { color: var(--clr-info); background: rgba(59,130,246,.1); &:hover { background: rgba(59,130,246,.2); } }
    .resolved-text { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--clr-success); }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px 40px; text-align: center; gap: 16px;
    }
    .empty-icon-circle {
      width: 80px; height: 80px; border-radius: 50%; background: var(--clr-bg-elevated);
      display: flex; align-items: center; justify-content: center; color: var(--clr-text-dim);
      opacity: 0.5;
    }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 20px; margin-top: 32px; }
    .page-info { font-size: 14px; color: var(--clr-text-muted); }
  `],
})
export class AdminSupportComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  protected readonly tickets = signal<any[]>([]);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);

  async ngOnInit() { await this.load(); }

  async load() {
    this.loading.set(true);
    try {
      const res = await this.adminService.listSupportTickets(this.page(), 10);
      this.tickets.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch {
      this.toast.error('Failed to load support tickets');
    } finally {
      this.loading.set(false);
    }
  }

  async updateStatus(ticket: any, status: string) {
    try {
      await this.adminService.updateTicketStatus(ticket.id, status);
      this.toast.success(`Ticket status updated to ${status}`);
      await this.load();
    } catch {
      this.toast.error('Failed to update ticket');
    }
  }

  protected prevPage() { this.page.update(p => p - 1); void this.load(); }
  protected nextPage() { this.page.update(p => p + 1); void this.load(); }

  protected priorityBadge(p: string): string {
    const m: Record<string, string> = { HIGH: 'error', NORMAL: 'info', LOW: 'closed' };
    return m[p] ?? 'info';
  }

  protected statusBadge(s: string): string {
    const m: Record<string, string> = { OPEN: 'pending', IN_PROGRESS: 'info', CLOSED: 'active' };
    return m[s] ?? 'info';
  }
}
