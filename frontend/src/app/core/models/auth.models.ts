export type Role = 'USER' | 'RIDER' | 'ADMIN';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  phone: string;
  email?: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
}

export interface LoginDto {
  phone: string;
  password: string;
}

export interface RegisterDto {
  phone: string;
  password: string;
  fullName: string;
  email?: string;
}

export interface RegisterRiderDto extends RegisterDto {
  licenseNumber: string;
  bikeRegistration: string;
  bikeModel?: string;
}
