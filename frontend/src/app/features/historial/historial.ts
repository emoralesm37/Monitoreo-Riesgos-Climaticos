import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlertasService } from '../../core/services/alertas';
import { FormsModule } from '@angular/forms';

interface EventoHistorial {
  id: number;
  fecha: string;
  fenomeno: string;
  sensorName: string;
  community: string;
  severity: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo';
  mensaje?: string;
  estado?: 'Resuelta';
}

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [FormsModule, DatePipe],
  styleUrl: './historial.scss',
  templateUrl: './historial.html',
})
export class Historial implements OnInit {
  private readonly service = inject(AlertasService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  loading = false;
  error = '';

  eventos: EventoHistorial[] = [];

  filtroFenomeno = '';
  filtroSeveridad = '';

  ngOnInit() { this.cargarHistorial(); }

  cargarHistorial(): void {
    if (this.loading) return;
    this.loading = true; this.error = '';
    this.service.query({ status: 'RESUELTA' }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: alerts => {
        this.eventos = alerts.map(a => ({ id: a.alertId, fecha: a.resolvedAt || a.createdAt,
          fenomeno: a.phenomenon ? ({INUNDACION:'Inundaci\u00f3n',SEQUIA:'Sequ\u00eda',TORMENTA:'Tormenta',HELADA:'Helada',INCENDIO_FORESTAL:'Incendio forestal',SISTEMA:'Sistema'})[a.phenomenon] : 'Sin fenomeno',
          sensorName: a.sensorName || `Sensor ${a.sensorId}`, community: a.communityName || 'Sin comunidad',
          severity: ({VERDE:'Verde', AMARILLO:'Amarillo', NARANJA:'Naranja', ROJO:'Rojo'} as const)[a.severity],
          mensaje: a.message, estado: 'Resuelta' }));
        this.loading = false; this.cdr.markForCheck();
      },
      error: error => {
        this.error = error.status === 401 ? 'Sesion expirada. Inicia sesion nuevamente.' :
          error.status === 403 ? 'No tienes permiso para consultar el historial.' : 'No se pudo consultar el historial real de alertas.';
        this.loading = false; this.cdr.markForCheck();
      }
    });
  }

  get eventosFiltrados(): EventoHistorial[] {
    return this.eventos.filter(evento => {
      const coincideFenomeno =
        !this.filtroFenomeno ||
        evento.fenomeno === this.filtroFenomeno;

      const coincideSeveridad =
        !this.filtroSeveridad ||
        evento.severity === this.filtroSeveridad;

      return coincideFenomeno && coincideSeveridad;
    });
  }

  limpiarFiltros(): void {
    this.filtroFenomeno = '';
    this.filtroSeveridad = '';
  }
}