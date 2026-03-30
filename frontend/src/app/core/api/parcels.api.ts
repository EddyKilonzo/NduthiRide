import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { Parcel, CreateParcelDto, ParcelStatus } from '../models/parcel.models';

@Injectable({ providedIn: 'root' })
export class ParcelsApi extends BaseApiService {
  private readonly path = '/parcels';

  async create(dto: CreateParcelDto): Promise<Parcel> {
    return this.post<Parcel>(this.path, dto);
  }

  async getMyParcels(page = 1, limit = 10, status?: ParcelStatus): Promise<{ data: Parcel[]; total: number; totalPages: number }> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    return this.get<{ data: Parcel[]; total: number; totalPages: number }>(this.path, params);
  }

  async getRiderHistory(page = 1, limit = 10, status?: ParcelStatus): Promise<{ data: Parcel[]; total: number; totalPages: number }> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    return this.get<{ data: Parcel[]; total: number; totalPages: number }>(`${this.path}/rider/history`, params);
  }

  async getNearby(lat?: number, lng?: number, radiusKm?: number): Promise<Parcel[]> {
    let params = new HttpParams();
    if (lat !== undefined) params = params.set('lat', lat);
    if (lng !== undefined) params = params.set('lng', lng);
    if (radiusKm !== undefined) params = params.set('radiusKm', radiusKm);
    return this.get<Parcel[]>(`${this.path}/nearby`, params);
  }

  async getById(id: string): Promise<Parcel> {
    return this.get<Parcel>(`${this.path}/${id}`);
  }

  async getActive(): Promise<Parcel | null> {
    return this.get<Parcel | null>(`${this.path}/active`);
  }

  async accept(id: string): Promise<Parcel> {
    return this.patch<Parcel>(`${this.path}/${id}/accept`, {});
  }

  async updateStatus(id: string, status: ParcelStatus): Promise<Parcel> {
    return this.patch<Parcel>(`${this.path}/${id}/status`, { status });
  }

  async uploadProof(id: string, imageUrl: string): Promise<Parcel> {
    return this.patch<Parcel>(`${this.path}/${id}/proof`, { imageUrl });
  }

  async estimate(dto: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number; weightKg: number }): Promise<{ deliveryFee: number; distanceKm: number; baseFee?: number; perKmRate?: number; weightSurcharge?: number }> {
    const params = new HttpParams()
      .set('pickupLat', dto.pickupLat).set('pickupLng', dto.pickupLng)
      .set('dropoffLat', dto.dropoffLat).set('dropoffLng', dto.dropoffLng)
      .set('weightKg', dto.weightKg);
    return this.get<{ deliveryFee: number; distanceKm: number; baseFee?: number; perKmRate?: number; weightSurcharge?: number }>(`${this.path}/estimate`, params);
  }

  async rate(id: string, score: number, comment?: string): Promise<void> {
    return this.post<void>(`${this.path}/${id}/rate`, { score, comment });
  }
}
