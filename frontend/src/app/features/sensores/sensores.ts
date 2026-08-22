import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SensoresService, Sensor } from '../../core/services/sensores';

@Component({
  imports: [CommonModule],
  selector: 'app-sensores',
  styleUrl: './sensores.scss',
  templateUrl: './sensores.html',
})
export class Sensores implements OnInit {
  sensores: Sensor[] = [];
  loading = true;
  error = '';

  constructor(private sensoresService: SensoresService) {}

  ngOnInit(): void {
    this.sensoresService.getAll().subscribe({
      next: (data) => {
        this.sensores = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'No se pudo conectar con el servidor';
        this.loading = false;
        console.error(err);
      },
    });
  }

  toggleStatus(sensor: Sensor): void {
    const nuevoEstado = !sensor.isActive;
    this.sensoresService.changeStatus(sensor.sensorId, nuevoEstado).subscribe({
      next: () => (sensor.isActive = nuevoEstado),
      error: (err) => console.error(err),
    });
  }
}