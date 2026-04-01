import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
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
    return this.request<AuthTokens>(
      this.http.post<any>(
        `${this.apiUrl}${this.path}/refresh`,
        {},
        { headers: { Authorization: `Bearer ${refreshToken}` } }
      )
    );
  }

  async logout(): Promise<void> {
    try {
      await this.post(`${this.path}/logout`, {});
    } catch {
      // Logout failure is usually ignored as we'll clear local state anyway
    }
  }

  async verifyEmail(otp: string): Promise<void> {
    return this.post(`${this.path}/email/verify`, { otp });
  }

  async resendOtp(): Promise<void> {
    return this.post(`${this.path}/email/resend-otp`, {});
  }

  async forgotPassword(email: string): Promise<void> {
    return this.post(`${this.path}/password/forgot`, { email });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    return this.post(`${this.path}/password/reset`, { token, newPassword: password });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return this.post(`${this.path}/password/change`, {
      currentPassword,
      newPassword,
    });
  }

  /** Fire-and-forget ping to wake Render from cold start before the user submits a form. */
  warmUp(): void {
    lastValueFrom(this.http.get(`${this.apiUrl}/health`)).catch(() => {});
  }
}
