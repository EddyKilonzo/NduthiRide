import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from './base-api.service';
import { GeocodeResult, DirectionsResult } from '../services/map.service';

@Injectable({ providedIn: 'root' })
export class MapApi extends BaseApiService {
  private readonly path = '/map';

  async geocode(q: string): Promise<GeocodeResult[]> {
    const params = new HttpParams().set('q', q);
    return this.get<GeocodeResult[]>(`${this.path}/geocode`, params);
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
    const params = new HttpParams().set('lat', lat).set('lng', lng);
    return this.get<GeocodeResult>(`${this.path}/reverse-geocode`, params);
  }

  async search(q: string): Promise<GeocodeResult[]> {
    const params = new HttpParams().set('q', q);
    return this.get<GeocodeResult[]>(`${this.path}/geocode`, params);
  }

  async getDirections(originLat: number, originLng: number, destLat: number, destLng: number): Promise<DirectionsResult> {
    const params = new HttpParams()
      .set('originLat', originLat).set('originLng', originLng)
      .set('destLat', destLat).set('destLng', destLng);
    return this.get<DirectionsResult>(`${this.path}/directions`, params);
  }

  async getETA(originLat: number, originLng: number, destLat: number, destLng: number): Promise<{ durationMins: number }> {
    const params = new HttpParams()
      .set('originLat', originLat).set('originLng', originLng)
      .set('destLat', destLat).set('destLng', destLng);
    return this.get<{ durationMins: number }>(`${this.path}/eta`, params);
  }
}
