import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { Observable, TimeoutError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '../../core/services/auth';
import {
  Comunidad,
  ComunidadesService,
  CrearComunidadRequest
} from '../../core/services/comunidades';

@Component({
  selector: 'app-comunidades',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comunidades.html',
  styleUrl: './comunidades.scss'
})
export class Comunidades implements OnInit {
  private readonly service = inject(ComunidadesService);
  private readonly auth = inject(Auth);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  comunidades: Comunidad[] = [];

  name = '';
  municipality = '';
  department = '';
  country = 'Guatemala';
  description = '';
  latitude: number | null = null;
  longitude: number | null = null;

  editandoId: number | null = null;
  cargando = false;
  guardando = false;

  mensaje = '';
  error = '';
  errorCarga = '';
  @ViewChild('coordinateConfirmation') coordinateConfirmation?: ElementRef<HTMLDialogElement>;
  confirmacionUbicacion = false;
  private originalLatitude: number | null = null;
  private originalLongitude: number | null = null;
  @ViewChild('statusConfirmation') statusConfirmation?: ElementRef<HTMLDialogElement>;
  statusTarget: Comunidad | null = null;
  changingStatus = false;
  statusError = '';
  search = '';
  statusFilter = '';
  departmentFilter = '';
  get activeCount() { return this.comunidades.filter(c => c.isActive).length; }
  get departments() { return [...new Set(this.comunidades.map(c => c.department))].sort(); }
  get filtered() {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const query = normalize(this.search.trim());
    return this.comunidades.filter(c => (!query || normalize(`${c.name} ${c.municipality} ${c.department}`).includes(query)) &&
      (!this.statusFilter || c.isActive === (this.statusFilter === 'active')) && (!this.departmentFilter || c.department === this.departmentFilter));
  }
  clearFilters() { this.search = ''; this.statusFilter = ''; this.departmentFilter = ''; }
  requestStatus(community: Comunidad) {
    if (!this.puedeAdministrar || this.cargando || this.guardando || this.changingStatus) return;
    this.statusTarget = community; this.statusError = ''; this.statusConfirmation?.nativeElement.showModal();
  }
  cancelStatus(event?: Event) {
    if (this.changingStatus) { event?.preventDefault(); return; }
    this.statusConfirmation?.nativeElement.close(); this.statusTarget = null; this.statusError = '';
  }
  confirmStatus() {
    if (!this.puedeAdministrar || !this.statusTarget || this.changingStatus) return;
    this.changingStatus = true; this.statusError = '';
    this.service.cambiarEstado(this.statusTarget.communityId, !this.statusTarget.isActive)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.changingStatus = false; this.cancelStatus(); this.mensaje = 'Estado actualizado en el servidor.';
          this.cargarComunidades(); this.cdr.markForCheck();
        }, error: error => {
          this.changingStatus = false; this.statusError = this.obtenerError(error, 'No se pudo cambiar el estado. Puedes reintentar.'); this.cdr.markForCheck();
        }
      });
  }

  get puedeAdministrar(): boolean {
    return this.auth.getCurrentUser()?.role === 'Administrador';
  }

  ngOnInit(): void {
    this.cargarComunidades();
  }

  cargarComunidades(): void {
    if (this.cargando) return;
    this.cargando = true;
    this.errorCarga = '';

    this.service.obtenerTodas().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        this.comunidades = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.errorCarga = this.obtenerError(
          error,
          'No se pudieron cargar las comunidades.'
        );
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  guardar(confirmado = false): void {
    if (this.guardando || this.changingStatus) {
      return;
    }

    this.error = '';
    this.mensaje = '';

    if (!this.puedeAdministrar) {
      this.error = 'No tienes permisos para administrar comunidades.';
      return;
    }

    const data: CrearComunidadRequest = {
      name: this.name.trim(),
      municipality: this.municipality.trim(),
      department: this.department.trim(),
      country: this.country.trim(),
      latitude: this.latitude,
      longitude: this.longitude,
      description: this.description.trim() || null
    };

    if (data.name.length < 3 || data.name.length > 120) {
      this.error = 'El nombre debe contener entre 3 y 120 caracteres.';
      return;
    }

    if (
      !data.municipality ||
      !data.department ||
      !data.country
    ) {
      this.error = 'Municipio, departamento y país son obligatorios.';
      return;
    }

    if (
      data.municipality.length > 120 ||
      data.department.length > 120 ||
      data.country.length > 100
    ) {
      this.error = 'Revisa la longitud del municipio, departamento y país.';
      return;
    }

    if ((data.description?.length ?? 0) > 500) {
      this.error = 'La descripción no puede superar 500 caracteres.';
      return;
    }

    if (
      data.latitude !== null &&
      (!Number.isFinite(data.latitude) ||
        data.latitude < -90 ||
        data.latitude > 90)
    ) {
      this.error = 'La latitud debe estar entre -90 y 90.';
      return;
    }

    if (
      data.longitude !== null &&
      (!Number.isFinite(data.longitude) ||
        data.longitude < -180 ||
        data.longitude > 180)
    ) {
      this.error = 'La longitud debe estar entre -180 y 180.';
      return;
    }

    if ((data.latitude === null) !== (data.longitude === null)) {
      this.error = 'Introduce latitud y longitud juntas, o deja ambas vacías.';
      return;
    }
    if (!confirmado && (data.latitude !== this.originalLatitude || data.longitude !== this.originalLongitude)) {
      this.confirmacionUbicacion = true;
      this.coordinateConfirmation?.nativeElement.showModal();
      return;
    }
    if (confirmado && !this.confirmacionUbicacion) return;
    this.cancelarUbicacion();
    const esEdicion = this.editandoId !== null;

    const request: Observable<Comunidad | void> =
  this.editandoId !== null
    ? this.service.actualizar(this.editandoId, data)
    : this.service.crear(data);

    this.guardando = true;

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.guardando = false;
        this.mensaje = esEdicion
          ? 'Comunidad actualizada correctamente.'
          : 'Comunidad creada correctamente.';

        this.limpiarFormulario();
        this.cargarComunidades();
        this.cdr.detectChanges();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando = false;
        this.error = this.obtenerError(
          error,
          'No se pudo guardar la comunidad.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  editar(comunidad: Comunidad): void {
    if (!this.puedeAdministrar || this.guardando || this.changingStatus || this.cargando) {
      return;
    }

    this.editandoId = comunidad.communityId;
    this.name = comunidad.name;
    this.municipality = comunidad.municipality;
    this.department = comunidad.department;
    this.country = comunidad.country;
    this.latitude = comunidad.latitude;
    this.longitude = comunidad.longitude;
    this.originalLatitude = comunidad.latitude;
    this.originalLongitude = comunidad.longitude;
    this.description = comunidad.description ?? '';

    this.error = '';
    this.mensaje = '';
  }

  cancelarEdicion(): void {
    if (this.guardando) {
      return;
    }

    this.limpiarFormulario();
    this.error = '';
    this.mensaje = '';
  }

  private limpiarFormulario(): void {
    this.editandoId = null;
    this.name = '';
    this.municipality = '';
    this.department = '';
    this.country = 'Guatemala';
    this.description = '';
    this.latitude = null;
    this.longitude = null;
    this.originalLatitude = null;
    this.originalLongitude = null;
  }

  cancelarUbicacion() {
    this.coordinateConfirmation?.nativeElement.close();
    this.confirmacionUbicacion = false;
  }

  private obtenerError(
    error: HttpErrorResponse,
    fallback: string
  ): string {
    if (error instanceof TimeoutError) return 'El servidor tardó demasiado. Actualiza el listado antes de repetir la operación.';
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }

    if (error.status === 401) {
      return 'Tu sesión expiró. Inicia sesión nuevamente.';
    }

    if (error.status === 403) {
      return 'No tienes permisos para realizar esta acción.';
    }

    if (error.status === 404) {
      return 'La comunidad solicitada ya no existe.';
    }

    if (error.status === 400) {
      const errors = error.error?.errors;

      if (errors && typeof errors === 'object') {
        const messages = Object.values(errors)
          .flat()
          .filter((value): value is string =>
            typeof value === 'string'
          );

        if (messages.length) {
          return messages.join(' ');
        }
      }

      return error.error?.detail ?? 'Revisa los datos ingresados.';
    }

    if (error.status === 409) {
      return error.error?.detail ??
        'La operación tiene un conflicto con los datos existentes.';
    }
    if (error.status === 429) return 'Demasiadas solicitudes. Espera un momento antes de reintentar.';

    return fallback;
  }
}
