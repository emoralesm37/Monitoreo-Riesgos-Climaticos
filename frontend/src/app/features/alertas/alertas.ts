import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Alerta, AlertasService } from '../../core/services/alertas';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-alertas', standalone: true, imports: [CommonModule, FormsModule],
  styleUrl: './alertas.scss', templateUrl: './alertas.html',
})
export class Alertas implements OnInit {
  alertas: Alerta[] = [];
  mensaje = '';
  loading = false;
  error = '';
  actionError = '';
  resolving = new Set<number>();
  statusFilter = 'ACTIVA';
  severityFilter = '';
  sensorFilter = '';
  fromFilter = '';
  toFilter = '';
  selected: Alerta | null = null;
  detailLoading = false;
  private readonly destroyRef = inject(DestroyRef);

  constructor(private service: AlertasService, private auth: Auth, private cdr: ChangeDetectorRef) {}

  get canResolve(): boolean {
    return ['Administrador', 'Operador', 'ADMIN', 'OPERATOR'].includes(this.auth.getCurrentUser()?.role ?? '');
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    if (this.loading || this.resolving.size) return;
    this.loading = true;
    this.error = '';
    this.alertas = [];
    if ([this.fromFilter, this.toFilter].some(value => value && !Number.isFinite(Date.parse(value)))) {
      this.loading = false; this.error = 'Revisa las fechas de consulta.'; return;
    }
    if (this.sensorFilter && (!Number.isInteger(Number(this.sensorFilter)) || Number(this.sensorFilter) <= 0)) {
      this.loading = false; this.error = 'El ID del sensor debe ser un entero positivo.'; return;
    }
    const params: Record<string, string> = {};
    if (this.statusFilter) params['status'] = this.statusFilter;
    if (this.severityFilter) params['severity'] = this.severityFilter;
    if (this.sensorFilter) params['sensorId'] = this.sensorFilter;
    if (this.fromFilter) params['from'] = new Date(this.fromFilter).toISOString();
    if (this.toFilter) params['to'] = new Date(this.toFilter).toISOString();
    if (params['from'] && params['to'] && params['from'] > params['to']) {
      this.loading = false; this.error = 'La fecha inicial debe ser anterior a la final.'; return;
    }
    this.service.query(params).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.alertas = [...data].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: error => {
        this.error = this.errorMessage(error);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  resolver(alerta: Alerta): void {
    if (!this.canResolve || this.resolving.has(alerta.alertId)) return;
    this.resolving.add(alerta.alertId);
    this.actionError = '';
    this.mensaje = '';
    this.service.resolve(alerta.alertId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.alertas = this.statusFilter === 'ACTIVA' ? this.alertas.filter(item => item.alertId !== alerta.alertId)
          : this.alertas.map(item => item.alertId === result.alertId ? result : item);
        if (this.selected?.alertId === result.alertId) this.selected = result;
        this.resolving.delete(alerta.alertId);
        this.mensaje = 'Alerta resuelta en el servidor.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.resolving.delete(alerta.alertId);
        this.actionError = this.errorMessage(error);
        this.cdr.markForCheck();
      },
    });
  }

  phenomenonLabel(value: Alerta['phenomenon']): string {
    return value ? ({ INUNDACION: 'Inundación', SEQUIA: 'Sequía', TORMENTA: 'Tormenta',
      HELADA: 'Helada', INCENDIO_FORESTAL: 'Incendio forestal', SISTEMA: 'Sistema' })[value] : 'Sin fenómeno';
  }

  detail(alerta: Alerta) {
    if (this.detailLoading) return;
    this.detailLoading = true;
    this.actionError = '';
    this.service.getById(alerta.alertId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => { this.selected = value; this.detailLoading = false; this.cdr.markForCheck(); },
      error: error => { this.actionError = this.errorMessage(error); this.detailLoading = false; this.cdr.markForCheck(); },
    });
  }

  private errorMessage(error: HttpErrorResponse): string {
    if (error.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (error.status === 403) return 'Tu rol no tiene permiso para realizar esta acción.';
    if (error.status === 409) return 'La alerta cambió de estado. Actualiza la lista.';
    return 'No se pudo consultar o actualizar el servicio de alertas. Intenta nuevamente.';
  }
}
