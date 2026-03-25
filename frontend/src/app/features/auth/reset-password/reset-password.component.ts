import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LucideAngularModule } from 'lucide-angular';
import { matchPassword } from '../auth-validators';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="auth-split-page auth-page-animate">

      <!-- Form side -->
      <div class="auth-split-page__form">
        <div class="auth-form-inner">

          <div class="rp-icon">
            <lucide-icon name="lock-keyhole" [size]="28"></lucide-icon>
          </div>

          @if (!token()) {
            <!-- No token in URL -->
            <h1>Invalid link</h1>
            <p class="auth-lead">
              This reset link is invalid or has expired.
              Please request a new one.
            </p>
            <a routerLink="/auth/forgot-password" class="auth-btn-black" style="display:flex;align-items:center;justify-content:center;margin-top:16px;text-decoration:none;">
              Request new link
            </a>

          } @else if (done()) {
            <!-- Success state -->
            <h1>Password updated</h1>
            <p class="auth-lead">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <a routerLink="/auth/login" class="auth-btn-black" style="display:flex;align-items:center;justify-content:center;margin-top:16px;text-decoration:none;">
              Sign in
            </a>

          } @else {
            <!-- Form -->
            <h1>Set new password</h1>
            <p class="auth-lead">
              Choose a strong password for your NduthiRide account.
            </p>

            <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form-stack">

              <div class="auth-field">
                <label class="auth-label-sr" for="rp-pw">New password</label>
                <div class="auth-input-pill-wrap">
                  <lucide-icon name="lock" [size]="18" class="auth-input-icon"></lucide-icon>
                  <input
                    id="rp-pw"
                    [type]="showPw() ? 'text' : 'password'"
                    formControlName="password"
                    autocomplete="new-password"
                    placeholder="New password"
                  />
                  <button type="button" class="auth-pw-toggle" (click)="showPw.set(!showPw())" aria-label="Toggle">
                    <lucide-icon [name]="showPw() ? 'eye-off' : 'eye'" [size]="18"></lucide-icon>
                  </button>
                </div>
                @if (form.get('password')?.invalid && form.get('password')?.touched) {
                  <p class="auth-error">Password must be at least 8 characters</p>
                }
              </div>

              <div class="auth-field">
                <label class="auth-label-sr" for="rp-confirm">Confirm password</label>
                <div class="auth-input-pill-wrap">
                  <lucide-icon name="lock" [size]="18" class="auth-input-icon"></lucide-icon>
                  <input
                    id="rp-confirm"
                    [type]="showPw() ? 'text' : 'password'"
                    formControlName="confirmPassword"
                    autocomplete="new-password"
                    placeholder="Confirm new password"
                  />
                </div>
                @if (form.get('confirmPassword')?.hasError('mismatch') && form.get('confirmPassword')?.touched) {
                  <p class="auth-error">Passwords do not match</p>
                }
              </div>

              @if (error()) {
                <p class="auth-error" style="text-align:center;padding-left:0;">{{ error() }}</p>
              }

              <button type="submit" class="auth-btn-black" [disabled]="loading()">
                @if (loading()) {
                  <span class="auth-btn-spinner"></span>
                  <span>Updating...</span>
                } @else {
                  <span>Update password</span>
                }
              </button>
            </form>
          }

          <footer class="auth-footer-links">
            <p><a routerLink="/auth/login">Back to sign in</a></p>
          </footer>

        </div>
      </div>

      <!-- Visual side -->
      <aside class="auth-split-page__aside" aria-label="Brand">
        <div class="auth-visual-panel rp-panel">
          <div class="auth-visual-panel__content">
            <div class="auth-glass auth-glass--badge">Security</div>
            <div class="auth-glass auth-glass--title">New password, same great rides.</div>
            <p class="auth-glass auth-glass--tagline">Your NduthiRide account is protected.</p>
          </div>
        </div>
      </aside>

    </div>
  `,
  styleUrls: ['../auth-pages.shared.scss'],
  styles: [`
    .rp-icon {
      width: 52px; height: 52px; border-radius: 14px;
      background: rgba(64, 138, 113, 0.1); border: 1px solid rgba(64, 138, 113, 0.25);
      display: flex; align-items: center; justify-content: center;
      color: var(--clr-primary); margin-bottom: 16px;
    }
    .rp-panel {
      background: linear-gradient(145deg, var(--clr-primary-dark) 0%, var(--clr-primary) 55%, var(--clr-primary-light) 100%);
    }
  `],
})
export class ResetPasswordComponent implements OnInit {
  private readonly auth  = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly done    = signal(false);
  protected readonly error   = signal('');
  protected readonly token   = signal('');
  protected readonly showPw  = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, matchPassword('password')]],
  });

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.token.set(t);
  }

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.loading.set(true);
    this.error.set('');
    try {
      const { password } = this.form.getRawValue();
      await this.auth.resetPassword(this.token(), password);
      this.done.set(true);
      this.toast.success('Password updated! Please sign in.');
    } catch {
      this.error.set('This reset link is invalid or has expired.');
      this.loading.set(false);
    }
  }
}
