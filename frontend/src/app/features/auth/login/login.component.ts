import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LucideAngularModule } from 'lucide-angular';
import { AUTH_HERO_LOGIN_URLS } from '../auth-hero.constants';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="auth-split-page auth-page-animate">
      <div class="auth-split-page__form">
        <div class="auth-form-inner">
          <h1>Welcome back!</h1>
          <p class="auth-lead">
            Book rides and track parcels in one place with NduthiRide. Sign in to continue.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form-stack auth-form-stack--stagger">
            <div class="auth-field">
              <label class="auth-label-sr" for="login-email">Email</label>
              <div class="auth-input-pill-wrap">
                <lucide-icon name="mail" [size]="18" class="auth-input-icon"></lucide-icon>
                <input
                  id="login-email"
                  formControlName="email"
                  type="email"
                  autocomplete="email"
                  placeholder="Email address"
                />
              </div>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                @if (form.get('email')?.hasError('required')) {
                  <p class="auth-error">Email is required</p>
                } @else if (form.get('email')?.hasError('email')) {
                  <p class="auth-error">Enter a valid email address</p>
                }
              }
            </div>

            <div class="auth-field">
              <label class="auth-label-sr" for="login-password">Password</label>
              <div class="auth-input-pill-wrap">
                <lucide-icon name="lock" [size]="18" class="auth-input-icon"></lucide-icon>
                <input
                  id="login-password"
                  [type]="showPw() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="current-password"
                  placeholder="Password"
                />
                <button type="button" class="auth-pw-toggle" (click)="showPw.set(!showPw())" aria-label="Toggle password visibility">
                  <lucide-icon [name]="showPw() ? 'eye-off' : 'eye'" [size]="18"></lucide-icon>
                </button>
              </div>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <p class="auth-error">Password is required</p>
              }
            </div>

            <div class="auth-forgot-row">
              <a routerLink="/auth/forgot-password">Forgot password?</a>
            </div>

            <button type="submit" class="auth-btn-black" [disabled]="loading()">
              @if (loading()) {
                <span class="auth-btn-spinner"></span>
                <span>Logging in...</span>
              } @else {
                <span>Sign in</span>
              }
            </button>
          </form>

          <div class="auth-divider"><span>or continue with</span></div>

          <div class="auth-social-row">
            <button type="button" class="auth-social-btn" (click)="socialSoon()" aria-label="Continue with Google (coming soon)">
              <span class="auth-social-g">G</span>
            </button>
            <button type="button" class="auth-social-btn" (click)="socialSoon()" aria-label="Continue with Apple (coming soon)">
              <svg class="auth-apple-svg" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                />
              </svg>
            </button>
            <button type="button" class="auth-social-btn" (click)="socialSoon()" aria-label="Continue with Facebook (coming soon)">
              <lucide-icon name="facebook" [size]="20"></lucide-icon>
            </button>
          </div>

          <footer class="auth-footer-links">
            <p>Not a member? <a [routerLink]="['/auth/register']">Register now</a></p>
            <p class="auth-footer-secondary">
              Want to earn with us?
              <a [routerLink]="['/auth/register']" [queryParams]="{ type: 'rider' }">Become a rider</a>
            </p>
          </footer>
        </div>
      </div>

      <aside class="auth-split-page__aside" aria-label="Brand">
        <div class="auth-visual-panel">
          <div class="auth-visual-panel__media" aria-hidden="true">
            <img
              [src]="heroSrc()"
              (error)="onHeroImgError()"
              alt=""
              width="1260"
              height="840"
              loading="eager"
              decoding="async"
            />
          </div>
          <div class="auth-visual-panel__overlay" aria-hidden="true"></div>
          
          <div class="auth-stats-marquee" aria-hidden="true">
            <div class="auth-stats-marquee__inner">
              <!-- Set 1 -->
              <div class="auth-stat-item"><span class="val">50,000+</span><span class="lab">Happy Riders</span></div>
              <div class="auth-stat-item"><span class="val">1,000,000+</span><span class="lab">Completed Jobs</span></div>
              <div class="auth-stat-item"><span class="val">4.8</span><span class="lab">Avg. Rating</span></div>
              <div class="auth-stat-item"><span class="val">5+ min</span><span class="lab">Pickup Time</span></div>
              <!-- Set 2 (for seamless loop) -->
              <div class="auth-stat-item"><span class="val">50,000+</span><span class="lab">Happy Riders</span></div>
              <div class="auth-stat-item"><span class="val">1,000,000+</span><span class="lab">Completed Jobs</span></div>
              <div class="auth-stat-item"><span class="val">4.8</span><span class="lab">Avg. Rating</span></div>
              <div class="auth-stat-item"><span class="val">5+ min</span><span class="lab">Pickup Time</span></div>
            </div>
          </div>

          <div class="auth-visual-panel__content">
            <div class="auth-glass auth-glass--badge">NduthiRide</div>
            <div class="auth-glass auth-glass--title">Fast rides. Reliable delivery.</div>
            <div class="auth-carousel-dots auth-carousel-dots--on-image" aria-hidden="true">
              <span></span><span class="is-active"></span><span></span>
            </div>
            <p class="auth-glass auth-glass--tagline">Make every trip simpler with <strong>NduthiRide</strong></p>
          </div>
        </div>
      </aside>
    </div>
  `,
  styleUrls: ['../auth-pages.shared.scss'],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(false);
  protected readonly showPw = signal(false);

  private heroUrlIndex = 0;
  protected readonly heroSrc = signal(AUTH_HERO_LOGIN_URLS[0]);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected onHeroImgError(): void {
    this.heroUrlIndex++;
    if (this.heroUrlIndex < AUTH_HERO_LOGIN_URLS.length) {
      this.heroSrc.set(AUTH_HERO_LOGIN_URLS[this.heroUrlIndex]);
    }
  }

  protected socialSoon(): void {
    this.toast.info('Social sign-in is coming soon.');
  }

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);

    const { email, password } = this.form.getRawValue();
    try {
      await this.auth.login({
        email: email.trim().toLowerCase(),
        password,
      });
      const role = this.auth.role();
      void this.router.navigate([role === 'ADMIN' ? '/admin' : role === 'RIDER' ? '/rider' : '/user']);
    } catch {
      this.loading.set(false);
    }
  }
}
