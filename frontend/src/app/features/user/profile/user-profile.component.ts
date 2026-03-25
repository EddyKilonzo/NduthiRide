import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import type { AccountProfile } from '../../../core/api/users.api';
import { AccountProfileEditorComponent } from '../../../shared/components/account-profile-editor/account-profile-editor.component';
import { ChangePasswordFormComponent } from '../../../shared/components/change-password-form/change-password-form.component';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AccountProfileEditorComponent, ChangePasswordFormComponent],
  template: `
    <div class="user-profile app-page">
      <header class="page-head">
        <div>
          <h1>My Profile</h1>
          <p>Manage your account details</p>
        </div>
      </header>

      <div class="profile-grid">
        <div class="panel panel--editor">
          <app-account-profile-editor (profileLoaded)="onProfileLoaded($event)" />
        </div>

        <div class="profile-aside">
          <div class="panel">
            <h3 class="panel-title">
              <lucide-icon name="user" [size]="16"></lucide-icon>
              Account info
            </h3>
            <div class="info-row"><span>Email</span><strong>{{ auth.user()?.email || '—' }}</strong></div>
            <div class="info-row"><span>Role</span><strong>{{ auth.user()?.role }}</strong></div>
            <div class="info-row">
              <span>Member since</span>
              <strong>{{ memberSince() ? (memberSince()! | date: 'mediumDate') : '—' }}</strong>
            </div>
          </div>

          <app-change-password-form />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .user-profile { animation: fadeIn 0.45s ease-out; }
    .page-head {
      margin-bottom: 28px;
      h1 { font-size: 22px; font-weight: 700; color: var(--clr-text); }
      p { color: var(--clr-text-muted); font-size: 14px; margin-top: 4px; }
    }
    .profile-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px;
      align-items: start;
    }
    .profile-aside {
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-width: 0;
    }
    .panel {
      background: var(--clr-bg-card);
      border: 1px solid var(--clr-border);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-card);
    }
    .panel--editor { grid-column: 1 / -1; }
    @media (min-width: 900px) {
      .panel--editor { grid-column: span 1; }
    }
    .panel-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; font-weight: 700; color: var(--clr-text-muted);
      text-transform: uppercase; letter-spacing: 0.06em;
      margin-bottom: 18px;
    }
    .info-row {
      display: flex; justify-content: space-between; gap: 12px;
      font-size: 14px; padding: 12px 0; border-bottom: 1px solid var(--clr-border);
      color: var(--clr-text-muted);
      &:last-child { border-bottom: none; }
      strong { color: var(--clr-text); font-weight: 600; text-align: right; word-break: break-all; }
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 899px) {
      .panel--editor { grid-column: 1 / -1; grid-row: auto; }
    }
    @media (max-width: 720px) {
      .profile-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class UserProfileComponent {
  protected readonly auth = inject(AuthService);
  protected readonly memberSince = signal<string | null>(null);

  protected onProfileLoaded(p: AccountProfile): void {
    this.memberSince.set(p.createdAt);
  }
}
