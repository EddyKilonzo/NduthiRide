import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthUser, LoginDto, RegisterDto, RegisterRiderDto } from '../models/auth.models';
import { AuthApi } from '../api/auth.api';
import type { AccountProfile, UpdateProfileRequest } from '../api/users.api';
import { UsersApi } from '../api/users.api';

const ACCESS_TOKEN_KEY  = 'nduthi_access';
const REFRESH_TOKEN_KEY = 'nduthi_refresh';
const USER_KEY          = 'nduthi_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api     = inject(AuthApi);
  private readonly usersApi = inject(UsersApi);
  private readonly router  = inject(Router);
  private readonly isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

  /** One refresh at a time — parallel 401s (e.g. home rides + parcels) must not rotate the refresh token twice. */
  private refreshChain: Promise<void> | null = null;

  // Reactive state — drives guards and UI
  private readonly _user = signal<AuthUser | null>(this.loadUser());

  readonly user   = this._user.asReadonly();
  readonly isAuth = computed(() => this._user() !== null);
  readonly role   = computed(() => this._user()?.role ?? null);

  // ─── Public API ─────────────────────────────────────────────────

  async login(dto: LoginDto): Promise<void> {
    try {
      const data = await this.api.login(dto);
      this.persist(data);
    } catch (error) {
      throw error;
    }
  }

  async register(dto: RegisterDto): Promise<void> {
    try {
      const data = await this.api.register(dto);
      this.persist(data);
    } catch (error) {
      throw error;
    }
  }

  async registerRider(dto: RegisterRiderDto): Promise<void> {
    try {
      const data = await this.api.registerRider(dto);
      this.persist(data);
    } catch (error) {
      throw error;
    }
  }

  async verifyEmail(otp: string): Promise<void> {
    await this.api.verifyEmail(otp);
  }

  async resendOtp(): Promise<void> {
    await this.api.resendOtp();
  }

  async forgotPassword(email: string): Promise<void> {
    await this.api.forgotPassword(email);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.api.resetPassword(token, password);
  }

  /** Updates password on the server and clears stored refresh token (must match server invalidation). */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.api.changePassword(currentPassword, newPassword);
    if (this.isBrowser) {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  async refresh(): Promise<void> {
    if (!this.refreshChain) {
      this.refreshChain = this.doRefresh().finally(() => {
        this.refreshChain = null;
      });
    }
    return this.refreshChain;
  }

  private async doRefresh(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token');

    const tokens = await this.api.refresh(refreshToken);
    if (this.isBrowser) {
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.logout();
    } finally {
      this.clear();
      void this.router.navigate(['/auth/login']);
    }
  }

  getAccessToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  updateUser(partial: Partial<AuthUser>): void {
    const current = this._user();
    if (!current) return;
    const updated = { ...current, ...partial };
    this._user.set(updated);
    if (this.isBrowser) {
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
    }
  }

  /** Refreshes the signed-in user from `GET /users/me` (e.g. after external changes). */
  async refreshUserFromServer(): Promise<void> {
    if (!this.getAccessToken()) return;
    const profile = await this.usersApi.getMe();
    this.updateUser(accountProfileToAuthUser(profile));
  }

  /** Full account row from API (includes `createdAt` for profile screens). */
  async fetchAccountProfile(): Promise<AccountProfile> {
    return this.usersApi.getMe();
  }

  /** Persists profile changes via `PATCH /users/me` and updates local user state. */
  async updateProfile(body: UpdateProfileRequest): Promise<AccountProfile> {
    const profile = await this.usersApi.updateMe(body);
    this.updateUser(accountProfileToAuthUser(profile));
    return profile;
  }

  // ─── Private helpers ────────────────────────────────────────────

  private persist(data: { accessToken: string; refreshToken: string; user: AuthUser }): void {
    if (this.isBrowser) {
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    if (!data.user?.id) {
      if (this.isBrowser) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
      throw new Error('Invalid auth response: missing user');
    }
    if (this.isBrowser) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    this._user.set(data.user);
  }

  private clear(): void {
    if (this.isBrowser) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this._user.set(null);
  }

  private loadUser(): AuthUser | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}

function accountProfileToAuthUser(p: AccountProfile): AuthUser {
  return {
    id: p.id,
    phone: p.phone,
    email: p.email ?? undefined,
    fullName: p.fullName,
    avatarUrl: p.avatarUrl,
    role: p.role,
    isActive: p.isActive,
  };
}
