import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, PLATFORM_ID, ViewChild, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type * as Leaflet from 'leaflet';
import { Comunidad } from '../../../core/services/comunidades';
import { Alerta } from '../../../core/services/alertas';

export function hasCoordinates(c: Pick<Comunidad, 'latitude' | 'longitude'>): boolean {
  return typeof c.latitude === 'number' && typeof c.longitude === 'number' &&
    Number.isFinite(c.latitude) && Number.isFinite(c.longitude) &&
    Math.abs(c.latitude) <= 90 && Math.abs(c.longitude) <= 180;
}

// Use DOM text nodes: community names never become executable popup HTML.
export function communityPopup(c: Comunidad, activeAlerts: Alerta[] = [], alertsAvailable = false): HTMLElement {
  const popup = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = c.name;
  popup.appendChild(title);
  const lines = [
    Number.isFinite(c.sensorCount) ? `Sensores asociados: ${c.sensorCount}` : 'Cantidad de sensores no disponible',
    c.isActive === true ? 'Registro administrativo: activo' : c.isActive === false ? 'Registro administrativo: inactivo' : 'Estado administrativo no disponible',
    !alertsAvailable ? 'Riesgo: sin datos disponibles' : activeAlerts.length ?
      `Alertas activas registradas: ${activeAlerts.length}. Severidad: ${activeAlerts.map(a => a.severity).filter((s, i, all) => all.indexOf(s) === i).join(', ')}` :
      'Sin alertas activas registradas; riesgo no confirmado',
  ];
  for (const line of lines) { const p = document.createElement('p'); p.textContent = line; popup.appendChild(p); }
  return popup;
}

@Component({
  selector: 'app-monitoring-map',
  templateUrl: './monitoring-map.html',
  styleUrl: './monitoring-map.scss',
})
export class MonitoringMap implements AfterViewInit, OnChanges, OnDestroy {
  @Input() communities: Comunidad[] = [];
  @Input() loading = false;
  @Input() error = false;
  @Input() alerts: Alerta[] = [];
  @Input() alertsAvailable = false;
  @Output() retry = new EventEmitter<void>();
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLDivElement>;
  readonly mapError = signal(false);
  readonly tilesError = signal(false);
  private readonly platform = inject(PLATFORM_ID);
  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private markers?: Leaflet.LayerGroup;
  private observer?: ResizeObserver;
  private frame?: number;
  private destroyed = false;

  get located() { return this.communities.filter(hasCoordinates); }
  get unlocated() { return this.communities.length - this.located.length; }
  get outsideGuatemala() { return this.located.filter(c => c.latitude! < 13.5 || c.latitude! > 18 || c.longitude! < -92.5 || c.longitude! > -88).length; }

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.platform)) return;
    try {
      const loaded = await import('leaflet');
      // Production bundling exposes CommonJS Leaflet through its default export.
      const L = ('default' in loaded ? loaded.default : loaded) as typeof Leaflet;
      if (this.destroyed) return;
      this.leaflet = L;
      this.map = L.map(this.canvas.nativeElement, { zoomControl: false, scrollWheelZoom: false }).setView([15.7, -90.3], 7);
      L.control.zoom({ position: 'topright' }).addTo(this.map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // OSM requires an identifying Referer. Send only the origin for tiles;
        // retain the site's no-referrer policy for OAuth and all other requests.
        referrerPolicy: 'origin',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        className: 'climate-map-tiles',
      }).on('tileerror', () => { if (!this.destroyed) this.tilesError.set(true); }).addTo(this.map);
      this.markers = L.layerGroup().addTo(this.map);
      this.renderMarkers();
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
        this.observer.observe(this.canvas.nativeElement);
      }
      this.frame = requestAnimationFrame(() => this.map?.invalidateSize({ pan: false }));
    } catch { if (!this.destroyed) this.mapError.set(true); }
  }

  ngOnChanges() { this.renderMarkers(); }
  resetView() { this.map?.setView([15.7, -90.3], 7); }
  showLocations() {
    if (!this.map || !this.leaflet || !this.located.length || this.loading || this.error) return;
    this.map.fitBounds(this.leaflet.latLngBounds(this.located.map(c => [c.latitude!, c.longitude!] as [number, number])), { padding: [25, 25], maxZoom: 11 });
  }

  private renderMarkers() {
    if (!this.map || !this.leaflet || !this.markers) return;
    this.markers.clearLayers();
    if (this.error || this.loading) return;
    for (const c of this.located) {
      const active = this.alertsAvailable ? this.alerts.filter(a => a.communityId === c.communityId && a.status === 'ACTIVA') : [];
      const priority = active.find(a => a.severity === 'ROJO') ? '#c94c66' : active.find(a => a.severity === 'NARANJA') ? '#d58646' :
        active.find(a => a.severity === 'AMARILLO') ? '#c4a132' : active.find(a => a.severity === 'VERDE') ? '#419578' : '#1695b2';
      const tooltip = document.createElement('span');
      tooltip.textContent = c.name;
      this.leaflet.circleMarker([c.latitude!, c.longitude!], {
        radius: 7, color: '#ffffff', weight: 2, fillColor: priority, fillOpacity: 1,
      }).bindPopup(communityPopup(c, active, this.alertsAvailable), { className: 'climate-community-popup' })
        .bindTooltip(tooltip, { permanent: false })
        .addTo(this.markers);
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.observer?.disconnect();
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.map?.remove();
    this.map = undefined;
  }
}
