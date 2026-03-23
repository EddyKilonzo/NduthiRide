import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerComponent } from '../../../shared/components/spinner/spinner.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, SpinnerComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">
          <span>🏍</span>
          <h1>NduthiRide</h1>
        </div>
        <p class="auth-sub">Create your account</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-group">
            <label>Full Name</label>
            <input formControlName="fullName" class="form-control" placeholder="Jane Mwangi" />
          </div>
          <div class="form-group">
            <label>Phone</label>
            <input formControlName="phone" class="form-control" type="tel" placeholder="07XXXXXXXX" />
            @if (form.get('phone')?.invalid && form.get('phone')?.touched) {
              <span class="form-error">Enter a valid Kenyan phone number</span>
            }
          </div>
          <div class="form-group">
            <label>Email (optional)</label>
            <input formControlName="email" class="form-control" type="email" placeholder="jane@example.com" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input formControlName="password" class="form-control"
              [type]="showPw() ? 'text' : 'password'" placeholder="At least 8 characters" />
          </div>

          <button type="submit" class="btn btn--primary btn--full btn--lg"
            [disabled]="loading() || form.invalid">
            @if (loading()) { <app-spinner [size]="18" /> }
            @else { Create Account }
          </button>
        </form>

        <div class="divider">or</div>
        <div class="auth-links">
          <a [routerLink]="['/auth/login']">Already have an account? Sign in</a>
          <a [routerLink]="['/auth/register-rider']">Register as a rider instead</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--clr-bg); padding: 24px; }
    .auth-card { width: 100%; max-width: 420px; background: var(--clr-bg-card); border: 1px solid var(--clr-border); border-radius: var(--radius-lg); padding: 40px 36px; display: flex; flex-direction: column; gap: 20px; }
    .auth-logo { display: flex; align-items: center; gap: 10px; justify-content: center; span { font-size: 32px; } h1 { font-size: 24px; font-weight: 700; color: var(--clr-primary); } }
    .auth-sub { text-align: center; color: var(--clr-text-muted); font-size: 14px; }
    form { display: flex; flex-direction: column; gap: 14px; }
    .auth-links { display: flex; flex-direction: column; align-items: center; gap: 8px; font-size: 13px; }
  `],
})
export class RegisterComponent {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast  = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly showPw  = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    fullName: ['', Validators.required],
    phone:    ['', [Validators.required, Validators.pattern(/^(\+254|0)(7|1)\d{8}$/)]],
    email:    [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);

    try {
      await this.auth.register(this.form.getRawValue());
      void this.router.navigate(['/user']);
    } catch (error) {
      this.loading.set(false);
    }
  }
}
