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
  rider?: {
    isVerified: boolean;
    isAvailable: boolean;
    ratingAverage: number;
    totalRides: number;
    licenseNumber: string | null;
    bikeRegistration: string | null;
    bikeModel: string | null;
  } | null;
}

export interface LoginDto {
  credential: string;
  password: string;
}

export interface RegisterDto {
  phone: string;
  password: string;
  fullName: string;
  email?: string;
}

export interface RegisterRiderDto extends RegisterDto {
  licenseNumber?: string;
  bikeRegistration?: string;
  bikeModel?: string;
}
