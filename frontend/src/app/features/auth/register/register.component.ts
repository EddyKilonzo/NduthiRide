import { Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { AUTH_HERO_REGISTER_URLS } from '../auth-hero.constants';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LucideAngularModule } from 'lucide-angular';
import { matchPassword } from '../auth-validators';

type AccountType = 'user' | 'rider';
type Strength = 'weak' | 'medium' | 'strong' | null;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LucideAngularModule],
  template: `
    <div class="auth-split-page auth-page-animate">
      <div class="auth-split-page__form">
        <div class="auth-form-inner auth-form-inner--compact">
          <h1>Create account</h1>
          <p class="auth-lead auth-lead--compact">
            Book rides or deliver with NduthiRide — one short form to get started.
          </p>

          <form
            [formGroup]="form"
            (ngSubmit)="submit()"
            class="auth-form-stack auth-form-stack--compact auth-form-stack--stagger"
          >
            <div class="auth-account-type" role="radiogroup" aria-label="Account type">
              <label class="auth-radio-tile">
                <input type="radio" formControlName="accountType" value="user" />
                <lucide-icon name="user" [size]="16"></lucide-icon>
                <span>Standard</span>
              </label>
              <label class="auth-radio-tile">
                <input type="radio" formControlName="accountType" value="rider" />
                <lucide-icon name="bike" [size]="16"></lucide-icon>
                <span>Rider</span>
              </label>
            </div>

            <div class="auth-field-row">
              <div class="auth-field">
                <label class="auth-label-sr" for="reg-first">First name</label>
                <div class="auth-input-pill-wrap auth-input-pill-wrap--compact">
                  <lucide-icon name="user" [size]="16" class="auth-input-icon"></lucide-icon>
                  <input id="reg-first" formControlName="firstName" autocomplete="given-name" placeholder="First name" />
                </div>
                @if (form.get('firstName')?.invalid && form.get('firstName')?.touched) {
                  <p class="auth-error">Required</p>
                }
              </div>
              <div class="auth-field">
                <label class="auth-label-sr" for="reg-second">Second name</label>
                <div class="auth-input-pill-wrap auth-input-pill-wrap--compact">
                  <lucide-icon name="user" [size]="16" class="auth-input-icon"></lucide-icon>
                  <input id="reg-second" formControlName="secondName" autocomplete="family-name" placeholder="Last name" />
                </div>
                @if (form.get('secondName')?.invalid && form.get('secondName')?.touched) {
                  <p class="auth-error">Required</p>
                }
              </div>
            </div>

            <div class="auth-field">
              <label class="auth-label-sr" for="reg-phone">Phone number</label>
              <div class="auth-input-pill-wrap auth-input-pill-wrap--compact">
                <lucide-icon name="phone" [size]="16" class="auth-input-icon"></lucide-icon>
                <input id="reg-phone" formControlName="phone" type="tel" autocomplete="tel" placeholder="Phone" />
              </div>
              @if (form.get('phone')?.invalid && form.get('phone')?.touched) {
                <p class="auth-error">Enter a valid Kenyan phone number</p>
              }
            </div>

            <div class="auth-field">
              <label class="auth-label-sr" for="reg-email">Email address</label>
              <div class="auth-input-pill-wrap auth-input-pill-wrap--compact">
                <lucide-icon name="mail" [size]="16" class="auth-input-icon"></lucide-icon>
                <input id="reg-email" formControlName="email" type="email" autocomplete="email" placeholder="Email address" />
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
              <label class="auth-label-sr" for="reg-password">Password</label>
              <div class="auth-input-pill-wrap auth-input-pill-wrap--compact">
                <lucide-icon name="lock" [size]="16" class="auth-input-icon"></lucide-icon>
                <input
                  id="reg-password"
                  [type]="showPw() ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="new-password"
                  placeholder="Password (8+ chars)"
                />
                <button type="button" class="auth-pw-toggle" (click)="showPw.set(!showPw())" aria-label="Toggle password visibility">
                  <lucide-icon [name]="showPw() ? 'eye-off' : 'eye'" [size]="16"></lucide-icon>
                </button>
              </div>
              
              <!-- Password Strength Indicator -->
              @if (form.get('password')?.value) {
                <div class="auth-pw-strength" [attr.data-strength]="passwordStrength()">
                  <div class="auth-pw-strength-bar">
                    <span></span><span></span><span></span>
                  </div>
                  <span class="auth-pw-strength-text">
                    {{ passwordStrength() | titlecase }} password
                  </span>
                </div>
              }

              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                @if (form.get('password')?.hasError('required')) {
                  <p class="auth-error">Password is required</p>
                } @else if (form.get('password')?.hasError('minlength')) {
                  <p class="auth-error">Use at least 8 characters</p>
                }
              }
            </div>

            <div class="auth-field">
              <label class="auth-label-sr" for="reg-confirm">Confirm password</label>
              <div class="auth-input-pill-wrap auth-input-pill-wrap--compact">
                <lucide-icon name="lock" [size]="16" class="auth-input-icon"></lucide-icon>
                <input
                  id="reg-confirm"
                  [type]="showPw2() ? 'text' : 'password'"
                  formControlName="confirmPassword"
                  autocomplete="new-password"
                  placeholder="Confirm password"
                />
                <button type="button" class="auth-pw-toggle" (click)="showPw2.set(!showPw2())" aria-label="Toggle confirm password visibility">
                  <lucide-icon [name]="showPw2() ? 'eye-off' : 'eye'" [size]="16"></lucide-icon>
                </button>
              </div>
              @if (form.get('confirmPassword')?.invalid && form.get('confirmPassword')?.touched) {
                @if (form.get('confirmPassword')?.hasError('required')) {
                  <p class="auth-error">Confirm your password</p>
                } @else if (form.get('confirmPassword')?.hasError('mismatch')) {
                  <p class="auth-error">Passwords do not match</p>
                }
              }
            </div>

            <button type="submit" class="auth-btn-black auth-btn-black--compact" [disabled]="loading()">
              @if (loading()) {
                <span class="auth-btn-spinner"></span>
                <span>{{ isRider() ? 'Creating rider account...' : 'Creating account...' }}</span>
              } @else {
                <span>{{ isRider() ? 'Create rider account' : 'Create account' }}</span>
              }
            </button>
          </form>

          <div class="auth-divider auth-divider--compact"><span>or continue with</span></div>

          <div class="auth-social-row auth-social-row--compact">
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
              <lucide-icon name="facebook" [size]="18"></lucide-icon>
            </button>
          </div>

          <footer class="auth-footer-links auth-footer-links--compact">
            <p>Already have an account? <a [routerLink]="['/auth/login']">Sign in</a></p>
            @if (isRider()) {
              <p class="auth-note">You’ll finish rider onboarding after sign-up.</p>
            }
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
            <div class="auth-glass auth-glass--badge">Join NduthiRide</div>
            <div class="auth-glass auth-glass--title">Your city, one ride away.</div>
            <div class="auth-carousel-dots auth-carousel-dots--on-image" aria-hidden="true">
              <span></span><span class="is-active"></span><span></span>
            </div>
            <p class="auth-glass auth-glass--tagline">Ride or earn with <strong>NduthiRide</strong> — same app, your choice.</p>
          </div>
        </div>
      </aside>
    </div>
  `,
  styleUrls: ['../auth-pages.shared.scss'],
})
export class RegisterComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(false);
  protected readonly showPw = signal(false);
  protected readonly showPw2 = signal(false);

  private heroUrlIndex = 0;
  protected readonly heroSrc = signal(AUTH_HERO_REGISTER_URLS[0]);

  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    accountType: this.fb.nonNullable.control<AccountType>('user'),
    firstName: ['', Validators.required],
    secondName: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(/^(\+254|0)(7|1)\d{8}$/)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, matchPassword('password')]],
  });

  protected readonly passwordStrength = computed(() => {
    const pw = this.form.get('password')?.value;
    if (!pw) return null;
    return this.calculateStrength(pw);
  });

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('type') === 'rider') {
      this.form.patchValue({ accountType: 'rider' });
    }

    this.form
      .get('password')!
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.form.get('confirmPassword')!.updateValueAndValidity({ emitEvent: false });
      });
  }

  protected isRider(): boolean {
    return this.form.get('accountType')!.value === 'rider';
  }

  protected onHeroImgError(): void {
    this.heroUrlIndex++;
    if (this.heroUrlIndex < AUTH_HERO_REGISTER_URLS.length) {
      this.heroSrc.set(AUTH_HERO_REGISTER_URLS[this.heroUrlIndex]);
    }
  }

  protected socialSoon(): void {
    this.toast.info('Social sign-in is coming soon.');
  }

  private calculateStrength(pw: string): Strength {
    let score = 0;
    if (pw.length > 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 2) return 'weak';
    if (score === 3) return 'medium';
    return 'strong';
  }

  protected async submit(): Promise<void> {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);

    const raw = this.form.getRawValue();
    const fullName = `${raw.firstName} ${raw.secondName}`.trim();

    try {
      if (raw.accountType === 'rider') {
        await this.auth.registerRider({
          fullName,
          phone: raw.phone,
          email: raw.email,
          password: raw.password,
        });
      } else {
        await this.auth.register({
          fullName,
          phone: raw.phone,
          password: raw.password,
          email: raw.email,
        });
      }
      this.toast.success('Account created! Welcome to NduthiRide.');
      void this.router.navigate(['/auth/verify-email']);
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        // 409 — account was created on a previous attempt that timed out
        if (err.status === 409) {
          this.toast.info('Account already exists — please sign in.');
          void this.router.navigate(['/auth/login']);
          return;
        }
        // 504 — all retries exhausted; first attempt may have succeeded on the server
        if (err.status === 504 || err.status === 0) {
          this.toast.warning('Registration timed out — your account may have been created. Try signing in.');
          void this.router.navigate(['/auth/login']);
          return;
        }
      }
      this.loading.set(false);
    }
  }
}
