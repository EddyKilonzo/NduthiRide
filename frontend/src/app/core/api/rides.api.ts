import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { Ride, CreateRideDto, FareEstimate, RideStatus } from '../models/ride.models';

@Injectable({ providedIn: 'root' })
export class RidesApi extends BaseApiService {
  private readonly path = '/rides';

  async create(dto: CreateRideDto): Promise<Ride> {
    return this.post<Ride>(this.path, dto);
  }

  async getMyRides(page = 1, limit = 10, status?: RideStatus): Promise<{ data: Ride[]; total: number; totalPages: number }> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    return this.get<{ data: Ride[]; total: number; totalPages: number }>(this.path, params);
  }

  async getById(id: string): Promise<Ride> {
    return this.get<Ride>(`${this.path}/${id}`);
  }

  async getActive(): Promise<Ride | null> {
    return this.get<Ride | null>(`${this.path}/active`);
  }

  async accept(id: string): Promise<Ride> {
    return this.patch<Ride>(`${this.path}/${id}/accept`, {});
  }

  async updateStatus(id: string, status: RideStatus): Promise<Ride> {
    return this.patch<Ride>(`${this.path}/${id}/status`, { status });
  }

  async cancel(id: string): Promise<Ride> {
    return this.patch<Ride>(`${this.path}/${id}/cancel`, {});
  }

  async estimate(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number): Promise<FareEstimate> {
    const params = new HttpParams()
      .set('pickupLat', pickupLat).set('pickupLng', pickupLng)
      .set('dropoffLat', dropoffLat).set('dropoffLng', dropoffLng);
    return this.get<FareEstimate>(`${this.path}/estimate`, params);
  }

  async rate(id: string, score: number, comment?: string): Promise<void> {
    return this.post<void>(`${this.path}/${id}/rate`, { score, comment });
  }
}
