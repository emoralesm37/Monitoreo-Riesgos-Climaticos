import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subscription, finalize, timeout } from 'rxjs';
import { Comunidad, ComunidadesService } from '../../core/services/comunidades';
import { Alerta, AlertasService } from '../../core/services/alertas';
import { Sensor, SensorReading, SensoresService } from '../../core/services/sensores';
import { MonitoringMap } from './monitoring-map/monitoring-map';

// The shared SQL service stores UTC DateTime but serializes it without a suffix.
export function utcTime(value: string | null | undefined): number {
  if (!value) return NaN;
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + 'Z');
}
export function readingPoints(readings: SensorReading[], period: string, now = Date.now()) {
  const cutoff = period ? now - Number(period) * 3600000 : -Infinity;
  return readings.filter(r => typeof r.value === 'number' && Number.isFinite(r.value) &&
    Number.isFinite(utcTime(r.timestamp)) && utcTime(r.timestamp) >= cutoff)
    .sort((a, b) => utcTime(a.timestamp) - utcTime(b.timestamp));
}
export function chartGeometry(readings: SensorReading[]) {
  if (!readings.length) return null;
  const values = readings.map(r => r.value), min = Math.min(...values), max = Math.max(...values);
  const pad = max === min ? Math.max(1, Math.abs(min) * .05) : (max - min) * .12;
  const first = utcTime(readings[0].timestamp), last = utcTime(readings.at(-1)!.timestamp);
  const points = readings.map(r => ({ x: last === first ? 320 : 50 + (utcTime(r.timestamp) - first) / (last - first) * 540,
    y: 190 - (r.value - (min - pad)) / (max - min + pad * 2) * 155, reading: r }));
  return { points, line: points.map(p => `${p.x},${p.y}`).join(' '), min: min - pad, max: max + pad, first, last };
}

@Component({ selector: 'app-dashboard', standalone: true, imports: [CommonModule, FormsModule, MonitoringMap],
  styleUrl: './dashboard.scss', templateUrl: './dashboard.html' })
export class Dashboard implements OnInit {
  private readonly communitiesService = inject(ComunidadesService);
  private readonly sensorsService = inject(SensoresService);
  private readonly alertsService = inject(AlertasService);
  private readonly destroyRef = inject(DestroyRef);
  readonly sensors = signal<Sensor[]>([]);
  readonly communities = signal<Comunidad[]>([]);
  readonly alerts = signal<Alerta[]>([]);
  readonly readings = signal<SensorReading[]>([]);
  readonly sensorLoading = signal(false); readonly communityLoading = signal(false); readonly alertLoading = signal(false);
  readonly sensorError = signal(''); readonly communityError = signal(''); readonly alertError = signal('');
  readonly readingLoading = signal(false); readonly readingError = signal('');
  readonly synchronized = signal<string | null>(null);
  readonly readingReceived = signal<string | null>(null);
  communityId = ''; sensorId = ''; period = '';
  private readingRequest?: Subscription;
  readonly severities = ['ROJO', 'NARANJA', 'AMARILLO', 'VERDE'] as const;
  ngOnInit() { this.refresh(); }
  get busy() { return this.sensorLoading() || this.communityLoading() || this.alertLoading(); }
  get visibleCommunities() { return this.communities().filter(c => !this.communityId || c.communityId === +this.communityId); }
  get visibleSensors() { return this.sensors().filter(s => !this.communityId || s.communityId === +this.communityId); }
  get visibleAlerts() { return this.alerts().filter(a => !this.communityId || a.communityId === +this.communityId); }
  get activeSensors() { return this.visibleSensors.filter(s => s.isActive === true).length; }
  get activeAlerts() { return this.visibleAlerts.filter(a => a.status === 'ACTIVA'); }
  get resolvedAlerts() { return this.visibleAlerts.filter(a => a.status === 'RESUELTA'); }
  get selectedSensor() { return this.visibleSensors.find(s => s.sensorId === +this.sensorId); }
  get recentAlerts() { return [...this.visibleAlerts].sort((a, b) => utcTime(b.resolvedAt || b.createdAt) - utcTime(a.resolvedAt || a.createdAt)).slice(0, 5); }
  get distributions() {
    const groups = new Map<string, number>();
    for (const sensor of this.visibleSensors) { const name = sensor.sensorType || 'Tipo no informado'; groups.set(name, (groups.get(name) || 0) + 1); }
    return [...groups].map(([name, count]) => ({ name, count, width: count / Math.max(1, this.visibleSensors.length) * 100 }));
  }
  severityCount(severity: string) { return this.activeAlerts.filter(a => a.severity === severity).length; }
  get lastActivity() {
    if (this.sensorError() || this.alertError() || this.sensorLoading() || this.alertLoading()) return null;
    const times = [...this.visibleSensors.map(s => utcTime(s.lastUpdatedAt)),
      ...this.visibleAlerts.flatMap(a => [utcTime(a.createdAt), utcTime(a.resolvedAt)])].filter(Number.isFinite);
    return times.length ? Math.max(...times) : null;
  }
  get validReadings() { return readingPoints(this.readings(), this.period); }
  get invalidReadings() { return this.readings().length - readingPoints(this.readings(), '').length; }
  get chart() { return chartGeometry(this.validReadings); }
  get orphanAlerts() { return this.alerts().filter(a => a.communityId === null || !this.communities().some(c => c.communityId === a.communityId)).length; }
  refresh() {
    if (this.busy) return;
    this.fetch(this.communitiesService.obtenerTodas(), this.communityLoading, this.communityError, data => {
      this.communities.set(data);
      if (this.communityId && !data.some(c => c.communityId === +this.communityId)) { this.communityId = ''; this.selectCommunity(); }
    });
    this.fetch(this.sensorsService.getAll(), this.sensorLoading, this.sensorError, data => { this.sensors.set(data); this.selectCommunity(); });
    this.fetch(this.alertsService.query({}), this.alertLoading, this.alertError, data => this.alerts.set(data));
  }
  private fetch<T>(source: Observable<T>, loading: ReturnType<typeof signal<boolean>>, error: ReturnType<typeof signal<string>>, receive: (value: T) => void) {
    loading.set(true); error.set('');
    source.pipe(timeout(15000), takeUntilDestroyed(this.destroyRef), finalize(() => loading.set(false))).subscribe({
      next: data => { receive(data); this.synchronized.set(new Date().toISOString()); },
      error: () => error.set('No disponible: no se pudo consultar la API. Reintenta actualizar.')
    });
  }
  selectCommunity() {
    if (!this.visibleSensors.some(s => String(s.sensorId) === this.sensorId))
      this.sensorId = String(this.visibleSensors.find(s => s.lastValue !== null)?.sensorId ?? this.visibleSensors[0]?.sensorId ?? '');
    this.loadReadings();
  }
  loadReadings() {
    this.readingRequest?.unsubscribe(); this.readings.set([]); this.readingError.set(''); this.readingReceived.set(null);
    if (!this.selectedSensor || this.sensorError()) { this.readingLoading.set(false); return; }
    this.readingLoading.set(true);
    this.readingRequest = this.sensorsService.getReadings(+this.sensorId).pipe(timeout(15000),
      takeUntilDestroyed(this.destroyRef), finalize(() => this.readingLoading.set(false))).subscribe({
      next: data => { this.readings.set(data); this.readingReceived.set(new Date().toISOString()); },
      error: () => this.readingError.set('No se pudieron consultar las lecturas. Reintenta; no significa que el sensor este desconectado.')
    });
  }
  alertCommunity(alert: Alerta) { return this.communities().find(c => c.communityId === alert.communityId)?.name || alert.communityName || 'Comunidad no informada'; }
}
