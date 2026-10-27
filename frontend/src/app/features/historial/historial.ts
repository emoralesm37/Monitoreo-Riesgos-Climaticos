import { Component } from '@angular/core';
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
  imports: [FormsModule],
  styleUrl: './historial.scss',
  templateUrl: './historial.html',
})
export class Historial {
  eventos: EventoHistorial[] = [];

  filtroFenomeno = '';
  filtroSeveridad = '';

  constructor() {
    this.cargarHistorial();
  }

  private cargarHistorial(): void {
    const historialGuardado =
      localStorage.getItem('climateguard_historial');

    if (historialGuardado) {
      this.eventos = JSON.parse(historialGuardado);
      return;
    }

    this.eventos = [
      {
        id: 1,
        fecha: '20/08/2026 14:32',
        fenomeno: 'Incendio forestal',
        sensorName: 'Sensor de temperatura',
        community: 'Comunidad El Progreso',
        severity: 'Naranja',
        mensaje: 'Temperatura elevada y humedad baja',
        estado: 'Resuelta'
      },
      {
        id: 2,
        fecha: '19/08/2026 09:10',
        fenomeno: 'Inundación',
        sensorName: 'Sensor de río',
        community: 'Comunidad Las Flores',
        severity: 'Rojo',
        mensaje: 'Nivel del río por encima del rango seguro',
        estado: 'Resuelta'
      },
      {
        id: 3,
        fecha: '18/08/2026 22:45',
        fenomeno: 'Tormenta',
        sensorName: 'Sensor de viento',
        community: 'Comunidad Las Flores',
        severity: 'Amarillo',
        mensaje: 'Ráfagas de viento en aumento',
        estado: 'Resuelta'
      }
    ];

    localStorage.setItem(
      'climateguard_historial',
      JSON.stringify(this.eventos)
    );
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