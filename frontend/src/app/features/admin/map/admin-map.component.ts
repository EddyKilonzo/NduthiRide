import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import * as L from 'leaflet';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

interface MapRider {
  id: string;
  fullName: string;
  lat: number;
  lng: number;
  status: 'AVAILABLE' | 'ACTIVE' | 'OFFLINE';
  lastSeen: string;
}

@Component({
  selector: 'app-admin-map',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="page app-page map-page">
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <lucide-icon name="map" [size]="28"></lucide-icon>
          </div>
          <div>
            <h1>Live Operations</h1>
            <p>Real-time view of all riders on the platform</p>
          </div>
        </div>
        <div class="header-actions">
          <div class="stats-pills">
            <div class="pill pill--success">
              <span class="dot"></span> {{ stats().available }} Available
            </div>
            <div class="pill pill--primary">
              <span class="dot"></span> {{ stats().active }} On Trip
            </div>
            <div class="pill pill--muted">
              {{ stats().total }} Total
            </div>
          </div>
        </div>
      </div>

      <div class="map-container-wrap card">
        <div #mapContainer class="map-el"></div>
        
        <!-- Legend Overlay -->
        <div class="map-legend">
          <div class="legend-item">
            <div class="marker-dot available"></div>
            <span>Available</span>
          </div>
          <div class="legend-item">
            <div class="marker-dot active"></div>
            <span>On Trip</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .map-page { height: calc(100vh - 120px); display: flex; flex-direction: column; }
    .header-content { display: flex; align-items: center; gap: 16px; }
    .header-icon {
      width: 48px; height: 48px; border-radius: var(--radius-md);
      background: var(--clr-bg-elevated); color: var(--clr-primary);
      display: flex; align-items: center; justify-content: center;
      box-shadow: var(--shadow-sm);
    }
    .stats-pills { display: flex; gap: 12px; }
    .pill {
      display: flex; align-items: center; gap: 8px; padding: 6px 14px;
      border-radius: var(--radius-full); font-size: 13px; font-weight: 600;
      background: var(--clr-bg-elevated); border: 1px solid var(--clr-border);
    }
    .pill--success { color: var(--clr-success); }
    .pill--primary { color: var(--clr-primary); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    
    .map-container-wrap { flex: 1; padding: 0; overflow: hidden; position: relative; }
    .map-el { width: 100%; height: 100%; border-radius: var(--radius-lg); }
    
    .map-legend {
      position: absolute; bottom: 24px; left: 24px;
      background: var(--clr-bg-card); padding: 12px 16px;
      border-radius: var(--radius-md); border: 1px solid var(--clr-border);
      box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 8px;
      z-index: 1000;
    }
    .legend-item { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 600; }
    .marker-dot { width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; }
    .marker-dot.available { background: var(--clr-success); }
    .marker-dot.active { background: var(--clr-primary); }

    :host ::ng-deep .leaflet-container { background: var(--clr-bg-elevated); font-family: inherit; }
  `],
})
export class AdminMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  
  private readonly auth = inject(AuthService);
  private map?: L.Map;
  private socket?: Socket;
  private markers = new Map<string, L.Marker>();
  
  protected readonly riders = signal<MapRider[]>([]);
  protected readonly stats = signal({ available: 0, active: 0, total: 0 });

  ngOnInit() {
    this.initMap();
    this.initSocket();
  }

  ngOnDestroy() {
    this.map?.remove();
    this.socket?.disconnect();
  }

  private initMap() {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: [-1.2921, 36.8219], // Nairobi
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors'
    }).addTo(this.map);
  }

  private initSocket() {
    this.socket = io(`${environment.apiUrl.replace('/api/v1', '')}/tracking`, {
      auth: { token: this.auth.getAccessToken() },
    });

    this.socket.on('connect', () => {
      console.log('Admin connected to live tracking');
      this.socket?.emit('admin:join');
    });

    this.socket.on('tracking:all-riders', (riders: MapRider[]) => {
      this.riders.set(riders);
      this.syncMarkers();
      this.updateStats();
    });

    this.socket.on('tracking:location', (update: { riderId: string; lat: number; lng: number }) => {
      this.updateRiderLocation(update);
    });
  }

  private createRiderIcon(status: string): L.DivIcon {
    const color = status === 'AVAILABLE' ? '#22C55E' : '#408A71';
    return L.divIcon({
      html: `<div style=\"width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);\"></div>`,
      className: '',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  private syncMarkers() {
    if (!this.map) return;
    const currentRiders = this.riders();
    
    // Remove markers for riders no longer present
    const riderIds = new Set(currentRiders.map(r => r.id));
    for (const [id, marker] of this.markers.entries()) {
      if (!riderIds.has(id)) {
        this.map.removeLayer(marker);
        this.markers.delete(id);
      }
    }

    // Add or update markers
    currentRiders.forEach(rider => {
      if (this.markers.has(rider.id)) {
        const marker = this.markers.get(rider.id)!;
        marker.setLatLng([rider.lat, rider.lng]);
        marker.setIcon(this.createRiderIcon(rider.status));
      } else {
        const marker = L.marker([rider.lat, rider.lng], {
          icon: this.createRiderIcon(rider.status)
        }).addTo(this.map!).bindPopup(`<b>${rider.fullName}</b><br>Status: ${rider.status}`);
        this.markers.set(rider.id, marker);
      }
    });
  }

  private updateRiderLocation(update: { riderId: string; lat: number; lng: number }) {
    const marker = this.markers.get(update.riderId);
    if (marker) {
      marker.setLatLng([update.lat, update.lng]);
    }
  }

  private updateStats() {
    const list = this.riders();
    this.stats.set({
      available: list.filter(r => r.status === 'AVAILABLE').length,
      active: list.filter(r => r.status === 'ACTIVE').length,
      total: list.length
    });
  }
}
