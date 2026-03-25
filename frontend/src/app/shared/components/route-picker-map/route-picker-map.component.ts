import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  input,
  output,
  effect,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../../environments/environment';

/** WGS84 point as Mapbox expects [lng, lat]. */
export type RouteMapPoint = { lng: number; lat: number };

function mapboxTokenConfigured(): boolean {
  const t = (environment.mapboxToken ?? '').trim();
  return t.length > 12 && !t.includes('YOUR_MAPBOX_TOKEN');
}

@Component({
  selector: 'app-route-picker-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="route-map"
      [class.route-map--no-token]="!tokenOk()"
      [class.route-map--picking]="!!pickMode()"
    >
      @if (!tokenOk()) {
        <div class="route-map__banner" role="status">
          <p>Set <code>mapboxToken</code> in <code>environment</code> to load the live map.</p>
        </div>
      }
      <div class="route-map__canvas" #host></div>
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
    }
    .route-map--no-token .route-map__canvas { opacity: 0.35; pointer-events: none; }
    .route-map--picking .route-map__canvas { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--clr-primary, #408A71) 55%, transparent); }
    .route-map__banner {
      position: absolute;
      z-index: 2;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      text-align: center;
      background: color-mix(in srgb, var(--clr-bg-card) 88%, transparent);
      pointer-events: none;
    }
    .route-map__banner p {
      margin: 0;
      font-size: 13px;
      color: var(--clr-text-muted);
      max-width: 280px;
      line-height: 1.45;
    }
    .route-map__banner code {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--clr-bg-elevated);
      color: var(--clr-text);
    }
    .route-map__canvas {
      width: 100%;
      height: 100%;
      min-height: min(360px, 45vh);
    }
  `],
})
export class RoutePickerMapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('host', { read: ElementRef }) private hostRef!: ElementRef<HTMLDivElement>;

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

  protected readonly tokenOk = computed(() => mapboxTokenConfigured());

  private map: mapboxgl.Map | null = null;
  private pickupMarker: mapboxgl.Marker | null = null;
  private dropoffMarker: mapboxgl.Marker | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    (mapboxgl as unknown as { accessToken: string }).accessToken = environment.mapboxToken ?? '';

    effect(() => {
      const p = this.pickup();
      const d = this.dropoff();
      if (this.map?.isStyleLoaded()) {
        this.applyMarkers(p, d);
      }
    });

    effect(() => {
      const mode = this.pickMode();
      queueMicrotask(() => this.applyPickCursor(mode));
    });
  }

  ngAfterViewInit(): void {
    if (!this.tokenOk()) {
      return;
    }

    const el = this.hostRef.nativeElement;
    const [lng, lat] = this.defaultCenter();

    this.map = new mapboxgl.Map({
      container: el,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [lng, lat],
      zoom: this.defaultZoom(),
    });
    this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const mapInstance = this.map;
    mapInstance.on('load', () => {
      this.applyMarkers(this.pickup(), this.dropoff());
      this.applyPickCursor(this.pickMode());
      mapInstance.on('click', (e) => {
        const mode = this.pickMode();
        if (!mode) return;
        this.locationPicked.emit({ leg: mode, lng: e.lngLat.lng, lat: e.lngLat.lat });
      });
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize();
    });
    this.resizeObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.pickupMarker?.remove();
    this.dropoffMarker?.remove();
    this.pickupMarker = null;
    this.dropoffMarker = null;
    this.map?.remove();
    this.map = null;
  }

  private applyPickCursor(mode: 'pickup' | 'dropoff' | null): void {
    const canvas = this.map?.getCanvas();
    if (!canvas) return;
    canvas.style.cursor = mode ? 'crosshair' : '';
  }

  private createDot(type: 'pickup' | 'dropoff'): HTMLDivElement {
    const el = document.createElement('div');
    const color = type === 'pickup' ? '#FF6B00' : '#22C55E';
    el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);`;
    return el;
  }

  private applyMarkers(pickup: RouteMapPoint | null, dropoff: RouteMapPoint | null): void {
    const map = this.map;
    if (!map) return;

    this.pickupMarker?.remove();
    this.dropoffMarker?.remove();
    this.pickupMarker = null;
    this.dropoffMarker = null;

    if (pickup) {
      this.pickupMarker = new mapboxgl.Marker({ element: this.createDot('pickup') })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(map);
    }
    if (dropoff) {
      this.dropoffMarker = new mapboxgl.Marker({ element: this.createDot('dropoff') })
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(map);
    }

    if (this.pickupMarker && this.dropoffMarker) {
      const bounds = new mapboxgl.LngLatBounds(
        this.pickupMarker.getLngLat(),
        this.dropoffMarker.getLngLat(),
      );
      map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
    } else if (pickup) {
      map.flyTo({ center: [pickup.lng, pickup.lat], zoom: 14 });
    } else if (dropoff) {
      map.flyTo({ center: [dropoff.lng, dropoff.lat], zoom: 14 });
    }
  }
}
