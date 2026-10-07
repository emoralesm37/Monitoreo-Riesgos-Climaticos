import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Comunidad,
  ComunidadesService,
  CrearComunidadRequest,
  ActualizarComunidadRequest
} from '../../core/services/comunidades';

@Component({
  selector: 'app-comunidades',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comunidades.html',
  styleUrl: './comunidades.scss'
})
export class Comunidades implements OnInit {
  private readonly comunidadesService = inject(ComunidadesService);
  private readonly cdr = inject(ChangeDetectorRef);

  comunidades: Comunidad[] = [];

  name = '';
  region = '';
  latitude: number | null = null;
  longitude: number | null = null;

  editandoId: number | null = null;

  cargando = false;
  mensaje = '';
  error = '';

  ngOnInit(): void {
    this.cargarComunidades();
  }

  cargarComunidades(): void {
    this.cargando = true;
    this.error = '';

    this.comunidadesService.obtenerTodas().subscribe({
      next: (data) => {
        this.comunidades = data;
        this.cargando = false;

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error cargando comunidades:', error);

        this.error = 'No se pudieron cargar las comunidades.';
        this.cargando = false;

        this.cdr.detectChanges();
      }
    });
  }

  guardar(): void {
    this.mensaje = '';
    this.error = '';

    const nombreLimpio = this.name.trim();

    if (nombreLimpio.length < 3) {
      this.error = 'El nombre debe tener al menos 3 caracteres.';
      return;
    }

    if (
      this.latitude !== null &&
      (this.latitude < -90 || this.latitude > 90)
    ) {
      this.error = 'La latitud debe estar entre -90 y 90.';
      return;
    }

    if (
      this.longitude !== null &&
      (this.longitude < -180 || this.longitude > 180)
    ) {
      this.error = 'La longitud debe estar entre -180 y 180.';
      return;
    }

    const data: CrearComunidadRequest | ActualizarComunidadRequest = {
      name: nombreLimpio,
      region: this.region.trim() || null,
      latitude: this.latitude,
      longitude: this.longitude
    };

    if (this.editandoId !== null) {
      this.actualizarComunidad(data);
    } else {
      this.crearComunidad(data);
    }
  }

  private crearComunidad(data: CrearComunidadRequest): void {
    this.comunidadesService.crear(data).subscribe({
      next: () => {
        this.mensaje = 'Comunidad creada correctamente.';

        this.limpiarFormulario();
        this.cargarComunidades();

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error creando comunidad:', error);

        if (error.status === 403) {
          this.error =
            'No tienes permisos para registrar comunidades.';
        } else {
          this.error = 'No se pudo crear la comunidad.';
        }

        this.cdr.detectChanges();
      }
    });
  }

  private actualizarComunidad(
    data: ActualizarComunidadRequest
  ): void {
    if (this.editandoId === null) {
      return;
    }

    const id = this.editandoId;

    this.comunidadesService.actualizar(id, data).subscribe({
      next: () => {
        this.mensaje = 'Comunidad actualizada correctamente.';

        this.limpiarFormulario();
        this.cargarComunidades();

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error actualizando comunidad:', error);

        if (error.status === 403) {
          this.error =
            'No tienes permisos para editar comunidades.';
        } else if (error.status === 404) {
          this.error =
            'La comunidad que intentas editar ya no existe.';
        } else {
          this.error =
            'No se pudo actualizar la comunidad.';
        }

        this.cdr.detectChanges();
      }
    });
  }

  editar(comunidad: Comunidad): void {
    this.editandoId = comunidad.communityId;

    this.name = comunidad.name;
    this.region = comunidad.region ?? '';
    this.latitude = comunidad.latitude;
    this.longitude = comunidad.longitude;

    this.mensaje = '';
    this.error = '';

    this.cdr.detectChanges();
  }

  cancelarEdicion(): void {
    this.limpiarFormulario();

    this.mensaje = '';
    this.error = '';

    this.cdr.detectChanges();
  }

  private limpiarFormulario(): void {
    this.editandoId = null;

    this.name = '';
    this.region = '';
    this.latitude = null;
    this.longitude = null;
  }
}