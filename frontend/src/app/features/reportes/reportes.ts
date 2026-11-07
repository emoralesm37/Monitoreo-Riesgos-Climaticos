import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReportMetadata, ReportesService, ReportStatus, ReportType, ReportFilters } from '../../core/services/reportes';
import { Sensor, SensorCommunity, SensorType } from '../../core/services/sensores';

@Component({
  selector: 'app-reportes',
  imports: [DatePipe, FormsModule],
  templateUrl: './reportes.html',
  styleUrl: './reportes.scss',
})
export class Reportes implements OnInit {
  private readonly service = inject(ReportesService);
  private readonly destroyRef = inject(DestroyRef);
  readonly reports = signal<ReportMetadata[]>([]);
  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly downloading = signal<ReadonlySet<string>>(new Set());
  readonly historyError = signal('');
  readonly actionError = signal('');
  readonly success = signal('');
  reportType: ReportType = 'communities';
  filters: ReportFilters = {};
  startDate = '';
  endDate = '';
  historyType: ReportType | '' = '';
  readonly offset = signal(0);
  readonly total = signal(0);
  readonly optionsLoading = signal(false);
  readonly optionsError = signal('');
  readonly sensors = signal<Sensor[]>([]);
  readonly communities = signal<SensorCommunity[]>([]);
  readonly types = signal<SensorType[]>([]);
  private optionsLoaded = false;

  selectType() {
    this.filters = {}; this.startDate = ''; this.endDate = ''; this.actionError.set('');
    if (this.reportType !== 'communities' && !this.optionsLoaded) this.loadOptions();
  }

  loadOptions() {
    if (this.optionsLoading()) return;
    this.optionsLoading.set(true); this.optionsError.set('');
    this.service.filterOptions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.sensors.set(data.sensors); this.communities.set(data.communities); this.types.set(data.types);
        this.optionsLoaded = true; this.optionsLoading.set(false);
      },
      error: error => { this.optionsError.set(this.errorMessage(error)); this.optionsLoading.set(false); },
    });
  }

  changeHistory() { this.offset.set(0); this.load(); }
  page(direction: number) {
    if (this.loading() || this.generating()) return;
    const next = this.offset() + direction * 50;
    if (next < 0 || next >= this.total()) return;
    this.offset.set(next); this.load();
  }

  ngOnInit() { this.load(); }

  load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.historyError.set('');
    this.service.history(this.offset(), this.historyType || undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.reports.set([...data.reports].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)));
        this.total.set(data.total);
        this.loading.set(false);
      },
      error: error => { this.historyError.set(this.errorMessage(error)); this.loading.set(false); },
    });
  }

  generate() {
    if (this.generating() || this.loading() || this.optionsLoading()) return;
    if (this.reportType !== 'communities' && !this.optionsLoaded) {
      this.actionError.set('Carga las opciones de filtros antes de generar.'); return;
    }
    const filters: ReportFilters = { ...this.filters };
    if (!['communities','sensors','sensor_status'].includes(this.reportType)) {
      if ((this.startDate && !Number.isFinite(Date.parse(this.startDate))) ||
          (this.endDate && !Number.isFinite(Date.parse(this.endDate))) ||
          (this.startDate && this.endDate && Date.parse(this.startDate) > Date.parse(this.endDate))) {
        this.actionError.set('Revisa el rango: la fecha inicial debe ser anterior a la final.'); return;
      }
      if (this.startDate) filters.startDate = new Date(this.startDate).toISOString();
      if (this.endDate) filters.endDate = new Date(this.endDate).toISOString();
    }
    this.generating.set(true);
    this.actionError.set('');
    this.success.set('');
    // Generation is not retried automatically: it creates persistent reports.
    const request = this.reportType === 'communities' ? this.service.generateCommunities() : this.service.generate(this.reportType, filters);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.generating.set(false);
        this.success.set(`Reporte generado: ${result.file_name}`);
        this.offset.set(0); this.historyType = '';
        this.load();
      },
      error: error => { this.actionError.set(this.errorMessage(error)); this.generating.set(false); },
    });
  }

  canDownload(report: ReportMetadata) {
    return report.status === 'completed' && !!report.file_name;
  }

  download(report: ReportMetadata) {
    if (!this.canDownload(report) || this.downloading().has(report._id)) return;
    this.downloading.update(ids => new Set([...ids, report._id]));
    this.actionError.set('');
    this.service.download(report._id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => {
        try {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = report.file_name!;
          document.body.appendChild(link);
          try { link.click(); } finally {
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 0);
          }
        } catch {
          this.actionError.set('El navegador no pudo guardar el PDF. Intenta descargarlo nuevamente.');
        } finally { this.finishDownload(report._id); }
      },
      error: error => { this.actionError.set(this.errorMessage(error)); this.finishDownload(report._id); },
    });
  }

  statusLabel(status: ReportStatus) {
    return ({ pending: 'Pendiente', processing: 'En proceso', completed: 'Completado', failed: 'Fallido' })[status] ?? status;
  }

  typeLabel(type: string) {
    return ({ communities: 'Comunidades', sensors: 'Sensores', readings: 'Lecturas', alerts:'Alertas', events:'Historial de fen?menos', sensor_status:'Estado de sensores', climate_statistics:'Estad?sticas clim?ticas', executive:'Resumen ejecutivo' } as Record<string,string>)[type] ?? type;
  }

  parametersLabel(parameters: Record<string, unknown>) {
    const labels: Record<string,string> = {sensorId:'Sensor', communityId:'Comunidad', sensorTypeId:'Tipo de sensor',
      isActive:'Activo', startDate:'Desde UTC', endDate:'Hasta UTC', evaluationStatus:'Evaluación'};
    const states: Record<string,string> = {delivered:'Entregada', pending:'Pendiente', unrecorded:'Sin registro'};
    return Object.entries(parameters).filter(([,value]) => value !== null).map(([key,value]) =>
      `${labels[key] ?? key}: ${key === 'evaluationStatus' ? states[String(value)] ?? value : value}`).join(' · ') || 'Sin filtros';
  }

  private finishDownload(id: string) {
    this.downloading.update(ids => { const next = new Set(ids); next.delete(id); return next; });
  }

  private errorMessage(error: HttpErrorResponse) {
    if (error.status === 413) return 'El reporte supera 20000 lecturas. Reduce el rango o selecciona un sensor.';
    if (error.status === 422 || error.status === 400) return 'Los filtros no son válidos. Revisa las fechas y selecciones.';
    if (error.status === 401) return 'Tu sesión expiró o no es válida. Vuelve a iniciar sesión.';
    if (error.status === 403) return 'No tienes permiso para acceder a reportes. Se requiere el rol Administrador.';
    if (error.status === 404) return 'El recurso no está disponible. Verifica el servicio o actualiza el historial.';
    if (error.status === 0 || error.status >= 500) return 'El servicio de reportes no está disponible. Intenta nuevamente más tarde.';
    return 'No se pudo completar la solicitud. Revisa el historial antes de volver a generar un reporte.';
  }
}
