import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface EventoHistorial {
  id: number;
  fecha: string;
  fenomeno: string;
  sensorName: string;
  community: string;
  severity: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo';
}

@Component({
  imports: [FormsModule],
  selector: 'app-historial',
  styleUrl: './historial.scss',
  templateUrl: './historial.html',
})
export class Historial {
  eventos: EventoHistorial[] = [
    { id: 1, fecha: '20/08/2026 14:32', fenomeno: 'IncendioForestal', sensorName: 'Sensor de temperatura', community: 'Comunidad El Progreso', severity: 'Naranja' },
    { id: 2, fecha: '19/08/2026 09:10', fenomeno: 'Inundacion', sensorName: 'Sensor de río', community: 'Comunidad Las Flores', severity: 'Rojo' },
    { id: 3, fecha: '18/08/2026 22:45', fenomeno: 'Tormenta', sensorName: 'Sensor de viento', community: 'Comunidad Las Flores', severity: 'Amarillo' },
    { id: 4, fecha: '17/08/2026 06:05', fenomeno: 'Helada', sensorName: 'Sensor de temperatura', community: 'Comunidad El Progreso', severity: 'Rojo' },
  ];

  filtroFenomeno = '';
  filtroSeveridad = '';

  get eventosFiltrados() {
    return this.eventos.filter(e =>
      (!this.filtroFenomeno || e.fenomeno === this.filtroFenomeno) &&
      (!this.filtroSeveridad || e.severity === this.filtroSeveridad)
    );
  }
}