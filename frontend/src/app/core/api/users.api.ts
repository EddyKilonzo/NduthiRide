import { Injectable } from '@angular/core';
import { BaseApiService } from './base-api.service';
import type { Role } from '../models/auth.models';

export interface AccountProfile {
  id: string;
  email: string | null;
  phone: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  phone?: string;
  email?: string | null;
  avatarUrl?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UsersApi extends BaseApiService {
  private readonly path = '/users';

  getMe(): Promise<AccountProfile> {
    return this.get<AccountProfile>(`${this.path}/me`);
  }

  updateMe(body: UpdateProfileRequest): Promise<AccountProfile> {
    return this.patch<AccountProfile>(`${this.path}/me`, body);
  }
}
