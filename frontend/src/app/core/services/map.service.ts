import { Injectable, inject } from '@angular/core';
import { MapApi } from '../api/map.api';

export interface GeocodeResult {
  full_address: string;
  lat: number;
  lng: number;
}

export interface DirectionsResult {
  distanceKm: number;
  durationMins: number;
  coordinates: [number, number][];
}

@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly api = inject(MapApi);

  async geocode(query: string): Promise<GeocodeResult[]> {
    try {
      return await this.api.geocode(query);
    } catch (error) {
      throw error;
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
    try {
      return await this.api.reverseGeocode(lat, lng);
    } catch (error) {
      throw error;
    }
  }

  async search(query: string): Promise<GeocodeResult[]> {
    try {
      return await this.api.search(query);
    } catch (error) {
      throw error;
    }
  }

  async getDirections(originLat: number, originLng: number, destLat: number, destLng: number): Promise<DirectionsResult> {
    try {
      return await this.api.getDirections(originLat, originLng, destLat, destLng);
    } catch (error) {
      throw error;
    }
  }

  async getETA(originLat: number, originLng: number, destLat: number, destLng: number): Promise<{ durationMins: number }> {
    try {
      return await this.api.getETA(originLat, originLng, destLat, destLng);
    } catch (error) {
      throw error;
    }
  }
}
