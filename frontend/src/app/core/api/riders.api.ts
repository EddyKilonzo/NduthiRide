import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';

export interface RiderProfile {
  id: string;
  accountId: string;
  licenseNumber: string | null;
  bikeRegistration: string | null;
  bikeModel: string | null;
  licenseImageUrl: string | null;
  idFrontImageUrl: string | null;
  idBackImageUrl: string | null;
  logbookImageUrl: string | null;
  isAvailable: boolean;
  isVerified: boolean;
  ratingAverage: number;
  totalRides: number;
  totalEarnings: number;
}

export interface UpdateRiderProfileDto {
  bikeModel?: string;
  bikeRegistration?: string;
  licenseNumber?: string;
  licenseImageUrl?: string;
  idFrontImageUrl?: string;
  idBackImageUrl?: string;
  logbookImageUrl?: string;
  avatarUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class RidersApi extends BaseApiService {
  private readonly path = '/riders';

  getMyProfile(): Promise<RiderProfile> {
    return this.get<RiderProfile>(`${this.path}/me`);
  }

  updateMyProfile(dto: UpdateRiderProfileDto): Promise<RiderProfile> {
    return this.patch<RiderProfile>(`${this.path}/me/profile`, dto);
  }

  updateAvailability(isAvailable: boolean): Promise<{ isAvailable: boolean }> {
    return this.patch<{ isAvailable: boolean }>(`${this.path}/me/availability`, { isAvailable });
  }

  updateLocation(lat: number, lng: number, speed?: number): Promise<void> {
    return this.patch<void>(`${this.path}/me/location`, { lat, lng, speed });
  }

  getPayouts(page = 1, limit = 10): Promise<any> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.get<any>(`${this.path}/me/payouts`, params);
  }

  requestPayout(amount: number, method: string, details: string): Promise<any> {
    return this.patch<any>(`${this.path}/me/payouts`, { amount, method, details });
  }
}
