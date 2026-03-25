import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService }  from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';
import type { AuthUser } from '../../../core/models/auth.models';

@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [CommonModule, FormsModule, SpinnerComponent],
  template: `
    <div class="page app-page">
      <div class="page-header">
        <div><h1>Accounts</h1><p>Manage users and riders</p></div>
      </div>

      <!-- Filters -->
      <div class="filters card">
        <select [(ngModel)]="roleFilter" (change)="load()">
          <option value="">All Roles</option>
          <option value="USER">Users</option>
          <option value="RIDER">Riders</option>
          <option value="ADMIN">Admins</option>
        </select>
        <select [(ngModel)]="statusFilter" (change)="load()">
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Suspended</option>
        </select>
      </div>

      @if (loading()) {
        <app-spinner />
      } @else if (accounts().length === 0) {
        <div class="empty-state"><h3>No accounts found</h3></div>
      } @else {
        <div class="card table-wrapper">
          <table>
            <thead>
              <tr><th>Name</th><th>Role</th><th>Phone</th><th>Email</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              @for (a of accounts(); track a.id) {
                <tr>
                  <td><strong>{{ a.fullName }}</strong></td>
                  <td><span class="badge badge--{{ roleBadge(a.role) }}">{{ a.role }}</span></td>
                  <td>{{ a.phone }}</td>
                  <td>{{ a.email }}</td>
                  <td>
                    <span class="badge" [class.badge--active]="a.isActive" [class.badge--closed]="!a.isActive">
                      {{ a.isActive ? 'Active' : 'Suspended' }}
                    </span>
                  </td>
                  <td>
                    <button
                      class="btn btn--sm"
                      [class.btn--danger]="a.isActive"
                      [class.btn--primary]="!a.isActive"
                      (click)="toggleStatus(a)"
                      [disabled]="a.role === 'ADMIN'">
                      {{ a.isActive ? 'Suspend' : 'Activate' }}
                    </button>
                  </td>
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
    .filters {
      display: flex; flex-wrap: wrap; gap: 14px; align-items: center;
      margin-bottom: 24px; padding: 18px 22px;
      box-shadow: var(--shadow-card); border-radius: var(--radius-lg);
    }
    .filters select {
      min-width: 160px; padding: 10px 14px; border: 1px solid var(--clr-border);
      border-radius: var(--radius-md); background: var(--clr-bg-elevated); color: var(--clr-text);
      font-size: 14px; cursor: pointer;
    }
    .table-wrapper { box-shadow: var(--shadow-card); }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
  `],
})
export class AdminAccountsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast        = inject(ToastService);

  protected readonly accounts   = signal<AuthUser[]>([]);
  protected readonly loading    = signal(true);
  protected readonly page       = signal(1);
  protected readonly totalPages = signal(1);

  protected roleFilter   = '';
  protected statusFilter = '';

  async ngOnInit(): Promise<void> { await this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const filters: { role?: string; isActive?: boolean } = {};
      if (this.roleFilter)   filters['role']     = this.roleFilter;
      if (this.statusFilter) filters['isActive']  = this.statusFilter === 'true';
      const res = await this.adminService.listAccounts(this.page(), 20, filters);
      this.accounts.set(res.data);
      this.totalPages.set(res.totalPages);
    } catch { /* silent */ } finally {
      this.loading.set(false);
    }
  }

  async toggleStatus(account: AuthUser): Promise<void> {
    try {
      const updated = await this.adminService.setAccountStatus(account.id, !account.isActive);
      this.accounts.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
      this.toast.success(`Account ${updated.isActive ? 'activated' : 'suspended'}`);
    } catch {
      this.toast.error('Action failed');
    }
  }

  protected prevPage(): void { this.page.update((p) => p - 1); void this.load(); }
  protected nextPage(): void { this.page.update((p) => p + 1); void this.load(); }

  protected roleBadge(role: string): string {
    const m: Record<string, string> = { USER: 'info', RIDER: 'active', ADMIN: 'pending' };
    return m[role] ?? 'info';
  }
}
