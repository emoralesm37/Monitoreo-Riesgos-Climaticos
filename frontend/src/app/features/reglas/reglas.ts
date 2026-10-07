import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Regla {
  alertRuleId: number;
  name: string;
  sensorTypeId: number;
  sensorTypeCode: string;
  sensorTypeUnit: string;
  minimumValue: number;
  maximumValue: number;
  alertSeverityId: number;
  alertSeverityName: string;
  phenomenonTypeId: number;
  phenomenonTypeName: string;
  message: string;
  isActive: boolean;
}
interface TipoSensor { sensorTypeId: number; code: string; unit: string; }

@Component({
  selector: 'app-reglas', standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reglas.html', styleUrl: './reglas.scss',
})
export class Reglas implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/alert-rules`;
  reglas = signal<Regla[]>([]);
  tipos = signal<TipoSensor[]>([]);
  cargando = signal(false);
  guardando = signal(false);
  error = signal('');
  errorFormulario = signal('');
  mensaje = signal('');
  mostrarFormulario = signal(false);
  editandoId: number | null = null;
  formulario = this.vacio();

  // IDs del catálogo inicial database/ClimateGuard.sql.
  // La API actual solo expone el catálogo de tipos de sensor.
  readonly severidades = [
    { id: 1, nombre: 'Verde' }, { id: 2, nombre: 'Amarillo' },
    { id: 3, nombre: 'Naranja' }, { id: 4, nombre: 'Rojo' },
  ];
  readonly fenomenos = [
    { id: 1, nombre: 'Inundación' }, { id: 2, nombre: 'Sequía' },
    { id: 3, nombre: 'Tormenta' }, { id: 4, nombre: 'Helada' },
    { id: 5, nombre: 'Incendio forestal' },
  ];

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    forkJoin({
      reglas: this.http.get<Regla[]>(this.url),
      tipos: this.http.get<TipoSensor[]>(`${environment.apiUrl}/catalogs/sensor-types`),
    }).subscribe({
      next: data => {
        this.reglas.set(data.reglas);
        this.tipos.set(data.tipos);
        this.cargando.set(false);
      },
      error: err => {
        this.error.set(this.descripcionError(err));
        this.cargando.set(false);
      },
    });
  }

  nuevaRegla(): void {
    if (this.guardando()) return;
    this.editandoId = null;
    this.formulario = this.vacio();
    this.errorFormulario.set('');
    this.mensaje.set('');
    this.mostrarFormulario.set(true);
  }

  editar(regla: Regla): void {
    if (this.guardando()) return;
    this.editandoId = regla.alertRuleId;
    this.formulario = {
      name: regla.name, sensorTypeId: regla.sensorTypeId,
      minimumValue: regla.minimumValue, maximumValue: regla.maximumValue,
      alertSeverityId: regla.alertSeverityId, phenomenonTypeId: regla.phenomenonTypeId,
      message: regla.message,
    };
    this.errorFormulario.set('');
    this.mensaje.set('');
    this.mostrarFormulario.set(true);
  }

  guardar(): void {
    if (this.guardando()) return;
    const f = this.formulario;
    if (!f.name.trim() || f.name.trim().length > 100 ||
        !f.message.trim() || f.message.trim().length > 300 ||
        !this.tipos().some(t => t.sensorTypeId === f.sensorTypeId) ||
        !this.severidades.some(s => s.id === f.alertSeverityId) ||
        !this.fenomenos.some(p => p.id === f.phenomenonTypeId)) {
      this.errorFormulario.set('Completa el nombre, los catálogos y el mensaje.');
      return;
    }
    if (f.minimumValue === null || f.maximumValue === null ||
        !Number.isFinite(f.minimumValue) || !Number.isFinite(f.maximumValue) ||
        f.minimumValue >= f.maximumValue ||
        Math.abs(f.minimumValue) > 99999999.99 || Math.abs(f.maximumValue) > 99999999.99) {
      this.errorFormulario.set('Ingresa un mínimo menor que el máximo, dentro de ±99,999,999.99.');
      return;
    }
    const body = { ...f, name: f.name.trim(), message: f.message.trim() };
    const editing = this.editandoId !== null;
    const request: Observable<Regla | void> = editing
      ? this.http.put<void>(`${this.url}/${this.editandoId}`, body)
      : this.http.post<Regla>(this.url, body);
    this.guardando.set(true);
    this.errorFormulario.set('');
    this.mensaje.set('');
    request.subscribe({
      next: () => {
        this.guardando.set(false);
        this.mostrarFormulario.set(false);
        this.mensaje.set(editing ? 'Regla actualizada en el servidor.' : 'Regla creada en el servidor.');
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        this.errorFormulario.set(this.descripcionError(err));
      },
    });
  }

  cancelar(): void {
    if (!this.guardando()) this.mostrarFormulario.set(false);
  }

  private vacio() {
    return { name: '', sensorTypeId: 0, minimumValue: null as number | null,
      maximumValue: null as number | null, alertSeverityId: 0, phenomenonTypeId: 0, message: '' };
  }

  private descripcionError(err: HttpErrorResponse): string {
    if (err.status === 0) return 'No se pudo conectar con la API. Comprueba que el backend esté activo.';
    if (err.status === 401) return 'La sesión expiró. Vuelve a iniciar sesión.';
    if (err.status === 403) return 'Solo un administrador puede gestionar reglas.';
    if (err.status === 404) return 'No se encontró el recurso. Actualiza la lista y comprueba que el backend incluya reglas.';
    if (err.status === 400 || err.status === 409) {
      const text = err.error?.detail ?? err.error?.message;
      if (typeof text === 'string') return text;
      return 'Revisa los datos: el nombre debe ser único y el mínimo menor que el máximo.';
    }
    return 'No se pudo completar la operación. Intenta nuevamente.';
  }
}
