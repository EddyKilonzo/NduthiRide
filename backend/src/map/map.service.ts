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
  
  // OpenStreetMap Nominatim for Geocoding (Free)
  private readonly geocodeUrl = 'https://nominatim.openstreetmap.org';
  // OSRM Public Instance for Routing (Free)
  private readonly routingUrl = 'https://router.project-osrm.org';

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  /** 
   * Custom headers for Nominatim (they require a valid User-Agent)
   */
  private get headers() {
    return {
      'User-Agent': 'NduthiRide-App/1.0 (contact@nduthiride.co.ke)',
    };
  }

  // ─── Geocoding ────────────────────────────────────────────

  /**
   * Forward geocode: converts an address string to coordinates using Nominatim.
   * Biased towards Kenya.
   */
  async geocode(query: string): Promise<GeocodeResult[]> {
    try {
      const encoded = encodeURIComponent(query);
      // viewbox for Kenya roughly: 33.9,-4.7 to 41.9,5.5
      const url = `${this.geocodeUrl}/search?q=${encoded}&format=json&addressdetails=1&limit=5&countrycodes=ke`;

      const response = await firstValueFrom(
        this.http.get<Array<{
          display_name: string;
          lat: string;
          lon: string;
        }>>(url, { headers: this.headers }),
      );

      return response.data.map((f) => ({
        full_address: f.display_name,
        lat: parseFloat(f.lat),
        lng: parseFloat(f.lon),
      }));
    } catch (error) {
      this.logger.error(`Geocode failed for query: ${query}`, error);
      throw new BadRequestException('Geocoding request failed');
    }
  }

  /**
   * Reverse geocode: converts coordinates to a human-readable address using Nominatim.
   */
  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url = `${this.geocodeUrl}/reverse?lat=${lat}&lon=${lng}&format=json`;

      const response = await firstValueFrom(
        this.http.get<{ display_name: string }>(url, { headers: this.headers }),
      );

      return response.data.display_name ?? `${lat}, ${lng}`;
    } catch (error) {
      this.logger.error(`Reverse geocode failed: ${lat},${lng}`, error);
      return `${lat}, ${lng}`;
    }
  }

  // ─── Directions ───────────────────────────────────────────

  /**
   * Gets a driving route between two points using OSRM API.
   * Returns distance, estimated duration, and the route geometry coordinates.
   */
  async getDirections(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<RouteResult> {
    try {
      const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
      const url = `${this.routingUrl}/route/v1/driving/${coords}?geometries=geojson&overview=full`;

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
   * Uses OSRM for routing duration.
   */
  async getETA(
    riderPos: Coordinates,
    destination: Coordinates,
  ): Promise<number> {
    try {
      const result = await this.getDirections(riderPos, destination);
      return result.durationMins;
    } catch {
      // Fall back to Haversine estimate if OSRM call fails
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
