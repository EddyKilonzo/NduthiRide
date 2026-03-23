import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import { LoginDto, RegisterDto, RegisterRiderDto, AuthTokens, AuthUser } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthApi extends BaseApiService {
  private readonly path = '/auth';

  async login(dto: LoginDto): Promise<AuthTokens & { user: AuthUser }> {
    return this.post<AuthTokens & { user: AuthUser }>(`${this.path}/login`, dto);
  }

  async register(dto: RegisterDto): Promise<AuthTokens & { user: AuthUser }> {
    return this.post<AuthTokens & { user: AuthUser }>(`${this.path}/register`, dto);
  }

  async registerRider(dto: RegisterRiderDto): Promise<AuthTokens & { user: AuthUser }> {
    return this.post<AuthTokens & { user: AuthUser }>(`${this.path}/register/rider`, dto);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    return this.post<AuthTokens>(`${this.path}/refresh`, { refreshToken });
  }

  async logout(): Promise<void> {
    try {
      await this.post(`${this.path}/logout`, {});
    } catch {
      // Logout failure is usually ignored as we'll clear local state anyway
    }
  }

  async verifyEmail(otp: string): Promise<void> {
    return this.post(`${this.path}/verify-email`, { otp });
  }

  async forgotPassword(email: string): Promise<void> {
    return this.post(`${this.path}/forgot-password`, { email });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    return this.post(`${this.path}/reset-password`, { token, password });
  }
}
