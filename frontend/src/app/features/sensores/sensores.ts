import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SensoresService, Sensor } from '../../core/services/sensores';
import { AuthSimuladoService } from '../../core/services/auth-simulado';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-sensores',
  styleUrl: './sensores.scss',
  templateUrl: './sensores.html',
})
export class Sensores implements OnInit {
  sensores: Sensor[] = [];
  loading = true;
  error = '';
  showForm = false;
  saving = false;

  newSensor = {
    name: '',
    sensorTypeId: 1,
    communityId: 1,
  };

constructor(
  private sensoresService: SensoresService,
  private cdr: ChangeDetectorRef,
  public authSimulado: AuthSimuladoService
) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.sensoresService.getAll().subscribe({
      next: (data) => {
        this.sensores = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = 'No se pudo conectar con el servidor';
        this.loading = false;
        this.cdr.detectChanges();
        console.error(err);
      },
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
  }

  submitNewSensor(): void {
    if (!this.newSensor.name.trim()) return;
    this.saving = true;
    this.sensoresService.create(this.newSensor).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.newSensor = { name: '', sensorTypeId: 1, communityId: 1 };
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.error = 'No se pudo crear el sensor';
        this.cdr.detectChanges();
        console.error(err);
      },
    });
  }

  toggleStatus(sensor: Sensor): void {
    const nuevoEstado = !sensor.isActive;
    this.sensoresService.changeStatus(sensor.sensorId, nuevoEstado).subscribe({
      next: () => {
        sensor.isActive = nuevoEstado;
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err),
    });
  }
}