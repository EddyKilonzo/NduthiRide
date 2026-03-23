import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div><h1>My Profile</h1><p>Manage your account details</p></div>
      </div>

      <div class="profile-grid">
        <div class="card profile-card">
          <div class="avatar-lg">{{ initial() }}</div>
          <p class="profile-name">{{ auth.user()?.fullName }}</p>
          <span class="badge badge--info">{{ auth.user()?.role }}</span>
        </div>

        <div class="card">
          <h3 class="card-title">Account Info</h3>
          <div class="info-row"><span>Full Name</span><strong>{{ auth.user()?.fullName }}</strong></div>
          <div class="info-row"><span>Role</span><strong>{{ auth.user()?.role }}</strong></div>
          <div class="info-row"><span>Member Since</span><strong>—</strong></div>
        </div>

        <div class="card coming-soon">
          <div class="cs-icon">🚧</div>
          <h3>Profile editing coming soon</h3>
          <p>Update your name, phone number, and profile photo</p>
        </div>

        <div class="card coming-soon">
          <div class="cs-icon">🔒</div>
          <h3>Password change coming soon</h3>
          <p>Update your password securely</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .card-title { font-size: 13px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 16px; }
    .profile-card { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px; }
    .avatar-lg { width: 80px; height: 80px; border-radius: 50%; background: var(--clr-primary); display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 700; color: #fff; }
    .profile-name { font-size: 18px; font-weight: 700; }
    .info-row { display: flex; justify-content: space-between; font-size: 14px; padding: 10px 0; border-bottom: 1px solid var(--clr-border); &:last-child { border: none; } color: var(--clr-text-muted); }
    .coming-soon { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px; text-align: center; color: var(--clr-text-muted); }
    .cs-icon { font-size: 36px; }
  `],
})
export class UserProfileComponent {
  protected readonly auth  = inject(AuthService);
  protected readonly toast = inject(ToastService);

  protected initial(): string {
    return this.auth.user()?.fullName?.charAt(0).toUpperCase() ?? '?';
  }
}
