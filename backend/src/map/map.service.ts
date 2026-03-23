import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { haversineKm } from '../common/utils/geo';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  full_address: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMins: number;
  /** Ordered array of [lng, lat] pairs forming the route geometry */
  coordinates: [number, number][];
}

@Injectable()
export class MapService {
  private readonly logger = new Logger(MapService.name);
  private readonly baseUrl = 'https://api.mapbox.com';

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  private get token(): string {
    return this.config.getOrThrow<string>('mapbox.accessToken');
  }

  // ─── Geocoding ────────────────────────────────────────────

  /**
   * Forward geocode: converts an address string to coordinates.
   * Biased towards Kenya by proximity hint to Nairobi.
   */
  async geocode(query: string): Promise<GeocodeResult[]> {
    try {
      const encoded = encodeURIComponent(query);
      const url =
        `${this.baseUrl}/search/geocode/v6/forward` +
        `?q=${encoded}&proximity=36.8219,-1.2921&country=KE&limit=5&access_token=${this.token}`;

      const response = await firstValueFrom(
        this.http.get<{
          features: Array<{
            properties: { full_address: string };
            geometry: { coordinates: [number, number] };
          }>;
        }>(url),
      );

      return response.data.features.map((f) => ({
        full_address: f.properties.full_address,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      }));
    } catch (error) {
      this.logger.error(`Geocode failed for query: ${query}`, error);
      throw new BadRequestException('Geocoding request failed');
    }
  }

  /**
   * Reverse geocode: converts coordinates to a human-readable address.
   */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url =
        `${this.baseUrl}/search/geocode/v6/reverse` +
        `?longitude=${lng}&latitude=${lat}&access_token=${this.token}`;

      const response = await firstValueFrom(
        this.http.get<{
          features: Array<{ properties: { full_address: string } }>;
        }>(url),
      );

      const first = response.data.features[0];
      return first?.properties.full_address ?? `${lat}, ${lng}`;
    } catch (error) {
      this.logger.error(`Reverse geocode failed: ${lat},${lng}`, error);
      return `${lat}, ${lng}`;
    }
  }

  // ─── Directions ───────────────────────────────────────────

  /**
   * Gets a driving route between two points using Mapbox Directions API.
   * Returns distance, estimated duration, and the route geometry coordinates.
   */
  async getDirections(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<RouteResult> {
    try {
      const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
      const url =
        `${this.baseUrl}/directions/v5/mapbox/driving/${coords}` +
        `?geometries=geojson&overview=full&access_token=${this.token}`;

      const response = await firstValueFrom(
        this.http.get<{
          routes: Array<{
            distance: number;
            duration: number;
            geometry: { coordinates: [number, number][] };
          }>;
        }>(url),
      );

      const route = response.data.routes[0];
      if (!route)
        throw new BadRequestException(
          'No route found between the given points',
        );

      return {
        distanceKm: parseFloat((route.distance / 1000).toFixed(2)),
        durationMins: Math.ceil(route.duration / 60),
        coordinates: route.geometry.coordinates,
      };
    } catch (error) {
      this.logger.error('getDirections failed', error);
      throw new BadRequestException('Could not calculate route');
    }
  }

  /**
   * Calculates the ETA in minutes from a rider's current position to a destination.
   * Uses Mapbox Directions for real-time traffic-aware duration.
   */
  async getETA(
    riderPos: Coordinates,
    destination: Coordinates,
  ): Promise<number> {
    try {
      const result = await this.getDirections(riderPos, destination);
      return result.durationMins;
    } catch {
      // Fall back to Haversine estimate if Mapbox call fails
      const distanceKm = haversineKm(
        riderPos.lat,
        riderPos.lng,
        destination.lat,
        destination.lng,
      );
      return Math.round((distanceKm / 25) * 60); // 25 km/h average
    }
  }
}
