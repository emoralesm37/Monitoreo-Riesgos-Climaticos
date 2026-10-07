import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SensoresService, Sensor, SensorCommunity, SensorType } from '../../core/services/sensores';
import { Auth } from '../../core/services/auth';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-sensores',
  styleUrl: './sensores.scss',
  templateUrl: './sensores.html',
})
export class Sensores implements OnInit {
  sensores: Sensor[] = [];
  communities: SensorCommunity[] = [];
  sensorTypes: SensorType[] = [];
  loading = true;
  catalogsLoading = false;
  error = '';
  formError = '';
  catalogError = '';
  actionError = '';
  success = '';
  showForm = false;
  saving = false;
  updating = new Set<number>();
  newSensor = { name: '', sensorTypeId: 0, communityId: 0 };

  constructor(
    private sensoresService: SensoresService,
    private cdr: ChangeDetectorRef,
    private auth: Auth,
  ) {}

  get canManage(): boolean {
    return ['Administrador', 'Operador'].includes(this.auth.getCurrentUser()?.role ?? '');
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.sensoresService.getAll().subscribe({
      next: data => {
        this.sensores = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = this.errorMessage(err, 'No se pudieron cargar los sensores.');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  toggleForm(): void {
    if (!this.canManage || this.saving) return;
    this.showForm = !this.showForm;
    this.formError = '';
    if (this.showForm) this.loadCatalogs();
  }

  loadCatalogs(): void {
    this.catalogsLoading = true;
    this.catalogError = '';
    forkJoin({
      communities: this.sensoresService.getCommunities(),
      types: this.sensoresService.getSensorTypes(),
    }).subscribe({
      next: data => {
        this.communities = data.communities;
        this.sensorTypes = data.types;
        this.catalogsLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.catalogError = this.errorMessage(err, 'No se pudieron cargar las comunidades y tipos.');
        this.catalogsLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  submitNewSensor(): void {
    if (!this.canManage || this.saving || this.catalogsLoading || this.catalogError) return;
    const name = this.newSensor.name.trim();
    if (name.length < 3 || name.length > 100 ||
        !this.communities.some(c => c.communityId === this.newSensor.communityId) ||
        !this.sensorTypes.some(t => t.sensorTypeId === this.newSensor.sensorTypeId)) {
      this.formError = 'Escribe un nombre de 3 a 100 caracteres y selecciona el tipo y la comunidad.';
      return;
    }
    this.saving = true;
    this.formError = '';
    this.success = '';
    this.sensoresService.create({ ...this.newSensor, name }).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.newSensor = { name: '', sensorTypeId: 0, communityId: 0 };
        this.success = 'Sensor creado correctamente.';
        this.load();
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.formError = this.errorMessage(err, 'No se pudo crear el sensor.');
        this.cdr.markForCheck();
      },
    });
  }

  toggleStatus(sensor: Sensor): void {
    if (!this.canManage || this.updating.has(sensor.sensorId)) return;
    const nextStatus = !sensor.isActive;
    this.updating.add(sensor.sensorId);
    this.actionError = '';
    this.success = '';
    this.sensoresService.changeStatus(sensor.sensorId, nextStatus).subscribe({
      next: () => {
        sensor.isActive = nextStatus;
        this.updating.delete(sensor.sensorId);
        this.success = 'Estado del sensor actualizado.';
        this.cdr.markForCheck();
      },
      error: err => {
        this.updating.delete(sensor.sensorId);
        this.actionError = this.errorMessage(err, 'No se pudo cambiar el estado del sensor.');
        this.cdr.markForCheck();
      },
    });
  }

  private errorMessage(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 0) return 'No hay conexión con la API. Comprueba que el backend siga ejecutándose.';
    if (error.status === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (error.status === 403) return 'Tu rol no tiene permiso para realizar esta acción.';
    if (error.status === 400 || error.status === 409 || error.status === 404) {
      if (typeof error.error?.message === 'string') return error.error.message;
      const errors = error.error?.errors;
      if (errors && typeof errors === 'object') {
        const messages = Object.values(errors).flat().filter((value): value is string => typeof value === 'string');
        if (messages.length) return messages.join(' ');
      }
    }
    return fallback;
  }
}
