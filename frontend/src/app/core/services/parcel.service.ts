import { Injectable, inject } from '@angular/core';
import { Parcel, CreateParcelDto, ParcelStatus } from '../models/parcel.models';
import { ParcelsApi } from '../api/parcels.api';

@Injectable({ providedIn: 'root' })
export class ParcelService {
  private readonly api = inject(ParcelsApi);

  async create(dto: CreateParcelDto): Promise<Parcel> {
    try {
      return await this.api.create(dto);
    } catch (error) {
      throw error;
    }
  }

  async getMyParcels(page = 1, limit = 10, status?: ParcelStatus): Promise<{ data: Parcel[]; total: number; totalPages: number }> {
    try {
      return await this.api.getMyParcels(page, limit, status);
    } catch (error) {
      throw error;
    }
  }

  async getRiderHistory(page = 1, limit = 10, status?: ParcelStatus): Promise<{ data: Parcel[]; total: number; totalPages: number }> {
    try {
      return await this.api.getRiderHistory(page, limit, status);
    } catch (error) {
      throw error;
    }
  }

  async getNearby(lat?: number, lng?: number, radiusKm?: number): Promise<Parcel[]> {
    try {
      return await this.api.getNearby(lat, lng, radiusKm);
    } catch (error) {
      throw error;
    }
  }

  async getById(id: string): Promise<Parcel> {
    try {
      return await this.api.getById(id);
    } catch (error) {
      throw error;
    }
  }

  async getActive(): Promise<Parcel | null> {
    try {
      return await this.api.getActive();
    } catch (error) {
      throw error;
    }
  }

  async accept(id: string): Promise<Parcel> {
    try {
      return await this.api.accept(id);
    } catch (error) {
      throw error;
    }
  }

  async updateStatus(id: string, status: ParcelStatus): Promise<Parcel> {
    try {
      return await this.api.updateStatus(id, status);
    } catch (error) {
      throw error;
    }
  }

  async uploadProof(id: string, imageUrl: string): Promise<Parcel> {
    try {
      return await this.api.uploadProof(id, imageUrl);
    } catch (error) {
      throw error;
    }
  }

  async estimate(dto: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number; weightKg: number }): Promise<{ deliveryFee: number; distanceKm: number; baseFee?: number; perKmRate?: number; weightSurcharge?: number }> {
    try {
      return await this.api.estimate(dto);
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
