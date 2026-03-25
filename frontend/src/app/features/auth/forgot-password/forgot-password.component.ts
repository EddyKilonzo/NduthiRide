import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="auth-split-page auth-page-animate">

      <!-- Form side -->
      <div class="auth-split-page__form">
        <div class="auth-form-inner">

          <div class="fp-icon">
            <lucide-icon name="key-round" [size]="28"></lucide-icon>
          </div>

          @if (!sent()) {
            <h1>Forgot password?</h1>
            <p class="auth-lead">
              Enter the email address for your account and we'll send you a reset link.
            </p>

            <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form-stack">
              <div class="auth-field">
                <label class="auth-label-sr" for="fp-email">Email</label>
                <div class="auth-input-pill-wrap">
                  <lucide-icon name="mail" [size]="18" class="auth-input-icon"></lucide-icon>
                  <input
                    id="fp-email"
                    formControlName="email"
                    type="email"
                    autocomplete="email"
                    placeholder="Email address"
                  />
                </div>
                @if (form.get('email')?.invalid && form.get('email')?.touched) {
                  <p class="auth-error">Enter a valid email address</p>
                }
              </div>

              <button type="submit" class="auth-btn-black" [disabled]="loading()">
                @if (loading()) {
                  <span class="auth-btn-spinner"></span>
                  <span>Sending...</span>
                } @else {
                  <span>Send reset link</span>
                }
              </button>
            </form>

          } @else {
            <!-- Success state -->
            <h1>Check your inbox</h1>
            <p class="auth-lead">
              If that email is registered, we've sent a password reset link.
              Check your spam folder if you don't see it within a minute.
            </p>

            <div class="fp-check">
              <lucide-icon name="circle-check-big" [size]="48"></lucide-icon>
            </div>
          }

          <footer class="auth-footer-links">
            <p><a routerLink="/auth/login">Back to sign in</a></p>
          </footer>

        </div>
      </div>

      <!-- Visual side -->
      <aside class="auth-split-page__aside" aria-label="Brand">
        <div class="auth-visual-panel fp-panel">
          <div class="auth-visual-panel__content">
            <div class="auth-glass auth-glass--badge">Account recovery</div>
            <div class="auth-glass auth-glass--title">Locked out? We've got you.</div>
            <p class="auth-glass auth-glass--tagline">Your ride is just a password reset away.</p>
          </div>
        </div>
      </aside>

    </div>
  `,
  styleUrls: ['../auth-pages.shared.scss'],
  styles: [`
    .fp-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: rgba(64, 138, 113, 0.1); border: 1px solid rgba(64, 138, 113, 0.25);
      display: flex; align-items: center; justify-content: center;
      color: var(--clr-primary); margin-bottom: 16px;
    }
    .fp-check {
      display: flex; justify-content: center; margin: 28px 0 8px;
      color: var(--clr-success);
    }
    .fp-panel {
      background: linear-gradient(145deg, var(--clr-primary-dark) 0%, var(--clr-primary) 55%, var(--clr-primary-light) 100%);
    }
  `],
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(false);
  protected readonly sent    = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.loading.set(true);
    try {
      await this.auth.forgotPassword(this.form.getRawValue().email.trim().toLowerCase());
      this.sent.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
