import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  input,
  output,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import * as L from 'leaflet';
import { MapService } from '../../../core/services/map.service';

export type RouteMapPoint = { lng: number; lat: number };

@Component({
  selector: 'app-route-picker-map',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div
      class="route-map"
      [class.route-map--picking]="!!pickMode()"
    >
      <div class="route-map__canvas" #host></div>

      @if (loadingRoute) {
        <div class="route-map__loader">
          <div class="spinner-sm"></div>
          <span>Calculating route...</span>
        </div>
      }

      <!-- Map controls -->
      <div class="map-controls">
        <button type="button" class="control-btn" (click)="centerOnUser()" title="Center on my location">
          <lucide-icon name="locate" [size]="18"></lucide-icon>
        </button>
      </div>
    </div>
    `,
    styles: [`
    :host { display: block; height: 100%; min-height: inherit; }
    .route-map {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: min(360px, 45vh);
      background: var(--clr-bg-elevated);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .route-map--picking .route-map__canvas { 
      box-shadow: inset 0 0 0 2px var(--clr-primary); 
    }
    .route-map__canvas {
      width: 100%;
      height: 100%;
      min-height: min(360px, 45vh);
      z-index: 1;
    }
    .route-map__loader {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      background: var(--clr-bg-card);
      padding: 6px 12px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      font-weight: 500;
      box-shadow: var(--shadow-md);
      border: 1px solid var(--clr-border);
    }
    .map-controls {
      position: absolute;
      bottom: 20px;
      right: 12px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .control-btn {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: var(--clr-bg-card);
      color: var(--clr-text);
      border: 1px solid var(--clr-border);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s;
    }
    .control-btn:hover {
      background: var(--clr-bg-elevated);
      color: var(--clr-primary);
    }
    .spinner-sm {
      width: 14px;
      height: 14px;
      border: 2px solid var(--clr-border);
      border-top-color: var(--clr-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Ensure Leaflet markers and controls follow theme or look decent */
    :host ::ng-deep .leaflet-container { background: var(--clr-bg-elevated); font-family: inherit; }
    :host ::ng-deep .leaflet-bar a { background-color: var(--clr-bg-card); color: var(--clr-text); border-bottom: 1px solid var(--clr-border); }
    :host ::ng-deep .leaflet-bar a:hover { background-color: var(--clr-bg-elevated); }

    :host ::ng-deep .custom-marker {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    :host ::ng-deep .marker-pin {
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      background: var(--pin-color, #408A71);
      position: absolute;
      transform: rotate(-45deg);
      left: 50%;
      top: 50%;
      margin: -15px 0 0 -12px;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    :host ::ng-deep .marker-pin::after {
      content: '';
      width: 10px;
      height: 10px;
      margin: 5px 0 0 5px;
      background: white;
      position: absolute;
      border-radius: 50%;
    }
    :host ::ng-deep .user-location-marker {
      width: 20px;
      height: 20px;
      background: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.3);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0px rgba(59, 130, 246, 0.4); }
      70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
      100% { box-shadow: 0 0 0 0px rgba(59, 130, 246, 0); }
    }
    `],
    })
    export class RoutePickerMapComponent implements AfterViewInit, OnDestroy {
    @ViewChild('host', { read: ElementRef }) private hostRef!: ElementRef<HTMLDivElement>;
    private readonly mapService = inject(MapService);

    /** Pickup marker (orange). */
    readonly pickup = input<RouteMapPoint | null>(null);
    /** Drop-off / delivery marker (green). */
    readonly dropoff = input<RouteMapPoint | null>(null);
    /** When set, the next map click sets that stop and emits {@link locationPicked}. */
    readonly pickMode = input<'pickup' | 'dropoff' | null>(null);
    /** Fired after user clicks the map while {@link pickMode} is active. */
    readonly locationPicked = output<{ leg: 'pickup' | 'dropoff'; lng: number; lat: number }>();
    /** Optional initial center when no markers yet [lng, lat]. */
    readonly defaultCenter = input<[number, number]>([36.8219, -1.2921]);
    readonly defaultZoom = input(12);

    private map: L.Map | null = null;
    private pickupMarker: L.Marker | null = null;
    private dropoffMarker: L.Marker | null = null;
    private userMarker: L.Marker | null = null;
    private routeLine: L.Polyline | null = null;
    private resizeObserver: ResizeObserver | null = null;
    protected loadingRoute = false;

    constructor() {
    effect(() => {
      const p = this.pickup();
      const d = this.dropoff();
      this.applyMarkers(p, d);
    });

    effect(() => {
      const mode = this.pickMode();
      this.applyPickCursor(mode);
    });
    }

    ngAfterViewInit(): void {
      // Small delay to ensure container dimensions are settled, 
      // especially when inside @if or dynamic layouts.
      setTimeout(() => {
        const el = this.hostRef.nativeElement;
        const [lng, lat] = this.defaultCenter();

        if (this.map) return; // Prevent double init

        this.map = L.map(el, {
          center: [lat, lng],
          zoom: this.defaultZoom(),
          zoomControl: false,
        });

        L.control.zoom({ position: 'topright' }).addTo(this.map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors'
        }).addTo(this.map);

        this.map.on('click', (e: L.LeafletMouseEvent) => {
          const mode = this.pickMode();
          if (!mode) return;
          this.locationPicked.emit({ leg: mode, lng: e.latlng.lng, lat: e.latlng.lat });
        });

        this.applyMarkers(this.pickup(), this.dropoff());
        this.applyPickCursor(this.pickMode());

        // Try to center on user if no points provided
        if (!this.pickup() && !this.dropoff()) {
          this.centerOnUser(false);
        }

        // Force Leaflet to detect container size
        this.map.invalidateSize();

        this.resizeObserver = new ResizeObserver(() => {
          this.map?.invalidateSize();
        });
        this.resizeObserver.observe(el);
      }, 50);
    }

    ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
    }

    protected centerOnUser(showMarker = true): void {
    if (!this.map || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.map?.setView([lat, lng], 15);

        if (showMarker) {
          if (this.userMarker) this.map?.removeLayer(this.userMarker);
          this.userMarker = L.marker([lat, lng], {
            icon: L.divIcon({
              className: '',
              html: '<div class="user-location-marker"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
          }).addTo(this.map!);
        }
      },
      () => {}, // Silently fail for auto-center
      { enableHighAccuracy: true, timeout: 5000 }
    );
    }

    private applyPickCursor(mode: 'pickup' | 'dropoff' | null): void {

    if (!this.map) return;
    const container = this.map.getContainer();
    if (mode) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
  }

  private createIcon(type: 'pickup' | 'dropoff'): L.DivIcon {
    const color = type === 'pickup' ? '#F59E0B' : '#22C55E';
    return L.divIcon({
      html: `<div class="custom-marker" style="--pin-color: ${color}"><div class="marker-pin"></div></div>`,
      className: '',
      iconSize: [30, 42],
      iconAnchor: [15, 42]
    });
  }

  private async applyMarkers(pickup: RouteMapPoint | null, dropoff: RouteMapPoint | null): Promise<void> {
    const map = this.map;
    if (!map) return;

    if (this.pickupMarker) { map.removeLayer(this.pickupMarker); this.pickupMarker = null; }
    if (this.dropoffMarker) { map.removeLayer(this.dropoffMarker); this.dropoffMarker = null; }
    if (this.routeLine) { map.removeLayer(this.routeLine); this.routeLine = null; }

    if (pickup) {
      this.pickupMarker = L.marker([pickup.lat, pickup.lng], { 
        icon: this.createIcon('pickup'),
        zIndexOffset: 1000
      }).addTo(map);
    }
    if (dropoff) {
      this.dropoffMarker = L.marker([dropoff.lat, dropoff.lng], { 
        icon: this.createIcon('dropoff'),
        zIndexOffset: 900
      }).addTo(map);
    }

    if (pickup && dropoff) {
      this.drawRoute(pickup, dropoff);
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 14);
    } else if (dropoff) {
      map.setView([dropoff.lat, dropoff.lng], 14);
    }
  }

  private async drawRoute(pickup: RouteMapPoint, dropoff: RouteMapPoint): Promise<void> {
    if (!this.map) return;
    
    try {
      this.loadingRoute = true;
      const result = await this.mapService.getDirections(
        pickup.lat, pickup.lng, 
        dropoff.lat, dropoff.lng
      );

      if (!this.map) return; // Component might have been destroyed

      const latLngs = result.coordinates.map(c => [c[1], c[0]] as L.LatLngExpression);
      
      this.routeLine = L.polyline(latLngs, {
        color: '#408A71',
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(this.map);

      // Fit bounds to show the entire route
      const group = L.featureGroup([this.pickupMarker!, this.dropoffMarker!, this.routeLine]);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
      
    } catch (error) {
      console.error('Failed to draw route:', error);
      // Fallback to straight line if API fails
      if (this.map && this.pickupMarker && this.dropoffMarker) {
        this.routeLine = L.polyline([
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng]
        ], {
          color: '#408A71',
          weight: 4,
          dashArray: '10, 10',
          opacity: 0.6
        }).addTo(this.map);
        
        const group = L.featureGroup([this.pickupMarker, this.dropoffMarker, this.routeLine]);
        this.map.fitBounds(group.getBounds(), { padding: [40, 40] });
      }
    } finally {
      this.loadingRoute = false;
    }
  }
}
