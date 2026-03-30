import { Injectable, inject } from '@angular/core';
import { Ride, CreateRideDto, FareEstimate, RideStatus } from '../models/ride.models';
import { RidesApi } from '../api/rides.api';

@Injectable({ providedIn: 'root' })
export class RideService {
  private readonly api = inject(RidesApi);

  async create(dto: CreateRideDto): Promise<Ride> {
    try {
      return await this.api.create(dto);
    } catch (error) {
      throw error;
    }
  }

  async getMyRides(page = 1, limit = 10, status?: RideStatus): Promise<{ data: Ride[]; total: number; totalPages: number }> {
    try {
      return await this.api.getMyRides(page, limit, status);
    } catch (error) {
      throw error;
    }
  }

  async getRiderHistory(page = 1, limit = 10, status?: RideStatus): Promise<{ data: Ride[]; total: number; totalPages: number }> {
    try {
      return await this.api.getRiderHistory(page, limit, status);
    } catch (error) {
      throw error;
    }
  }

  async getNearby(lat?: number, lng?: number, radiusKm?: number): Promise<Ride[]> {
    try {
      return await this.api.getNearby(lat, lng, radiusKm);
    } catch (error) {
      throw error;
    }
  }

  async getById(id: string): Promise<Ride> {
    try {
      return await this.api.getById(id);
    } catch (error) {
      throw error;
    }
  }

  async getActive(): Promise<Ride | null> {
    try {
      return await this.api.getActive();
    } catch (error) {
      throw error;
    }
  }

  async accept(id: string): Promise<Ride> {
    try {
      return await this.api.accept(id);
    } catch (error) {
      throw error;
    }
  }

  async updateStatus(id: string, status: RideStatus): Promise<Ride> {
    try {
      return await this.api.updateStatus(id, status);
    } catch (error) {
      throw error;
    }
  }

  async cancel(id: string): Promise<Ride> {
    try {
      return await this.api.cancel(id);
    } catch (error) {
      throw error;
    }
  }

  async estimate(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number): Promise<FareEstimate> {
    try {
      return await this.api.estimate(pickupLat, pickupLng, dropoffLat, dropoffLng);
    } catch (error) {
      throw error;
    }
  }

  async rate(id: string, score: number, comment?: string): Promise<void> {
    try {
      return await this.api.rate(id, score, comment);
    } catch (error) {
      throw error;
    }
  }
}
