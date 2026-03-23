import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthUser, LoginDto, RegisterDto, RegisterRiderDto } from '../models/auth.models';
import { AuthApi } from '../api/auth.api';

const ACCESS_TOKEN_KEY  = 'nduthi_access';
const REFRESH_TOKEN_KEY = 'nduthi_refresh';
const USER_KEY          = 'nduthi_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api    = inject(AuthApi);
  private readonly router = inject(Router);

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

  async refresh(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');

      const tokens = await this.api.refresh(refreshToken);
      localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } catch (error) {
      this.logout();
      throw error;
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
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  updateUser(partial: Partial<AuthUser>): void {
    const current = this._user();
    if (!current) return;
    const updated = { ...current, ...partial };
    this._user.set(updated);
    localStorage.setItem(USER_KEY, JSON.stringify(updated));
  }

  // ─── Private helpers ────────────────────────────────────────────

  private persist(data: { accessToken: string; refreshToken: string; user: AuthUser }): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    this._user.set(data.user);
  }

  private clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
  }

  private loadUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
