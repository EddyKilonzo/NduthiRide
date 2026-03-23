import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SpinnerComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <span>🏍</span>
          <h1>NduthiRide</h1>
        </div>
        <p class="auth-sub">Sign in to your account</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-group">
            <label for="phone">Phone</label>
            <input id="phone" formControlName="phone" class="form-control"
              type="tel" placeholder="07XXXXXXXX" autocomplete="tel" />
            @if (form.get('phone')?.invalid && form.get('phone')?.touched) {
              <span class="form-error">Enter a valid Kenyan phone number</span>
            }
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input id="password" formControlName="password" class="form-control"
              [type]="showPw() ? 'text' : 'password'" placeholder="••••••••" />
            <button type="button" class="pw-toggle" (click)="showPw.set(!showPw())">
              {{ showPw() ? 'Hide' : 'Show' }}
            </button>
          </div>

          <button type="submit" class="btn btn--primary btn--full btn--lg"
            [disabled]="loading() || form.invalid">
            @if (loading()) { <app-spinner [size]="18" /> }
            @else { Sign In }
          </button>
        </form>

        <div class="divider">or</div>

        <div class="auth-links">
          <a [routerLink]="['/auth/register']">Create user account</a>
          <a [routerLink]="['/auth/register-rider']">Register as rider</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: var(--clr-bg); padding: 24px;
    }
    .auth-card {
      width: 100%; max-width: 400px;
      background: var(--clr-bg-card); border: 1px solid var(--clr-border);
      border-radius: var(--radius-lg); padding: 40px 36px;
      display: flex; flex-direction: column; gap: 20px;
    }
    .auth-logo {
      display: flex; align-items: center; gap: 10px; justify-content: center;
      span { font-size: 32px; }
      h1 { font-size: 24px; font-weight: 700; color: var(--clr-primary); }
    }
    .auth-sub { text-align: center; color: var(--clr-text-muted); font-size: 14px; }
    form { display: flex; flex-direction: column; gap: 16px; }
    .pw-toggle {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      font-size: 12px; color: var(--clr-text-muted); cursor: pointer;
    }
    .form-group { position: relative; }
    .auth-links {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      font-size: 13px;
    }
  `],
})
export class LoginComponent {
  private readonly auth  = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast  = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly showPw  = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    phone:    ['', [Validators.required, Validators.pattern(/^(\+254|0)(7|1)\d{8}$/)]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);

    try {
      await this.auth.login(this.form.getRawValue());
      const role = this.auth.role();
      void this.router.navigate([role === 'ADMIN' ? '/admin' : role === 'RIDER' ? '/rider' : '/user']);
    } catch (error) {
      // Error message is handled by GlobalErrorInterceptor
      this.loading.set(false);
    }
  }
}
