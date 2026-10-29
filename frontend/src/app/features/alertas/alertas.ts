import { Component } from '@angular/core';

interface Alerta {
  alertId: number;
  sensorName: string;
  community: string;
  severity: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo';
  phenomenon: string;
  message: string;
  createdAt: string;
}

interface EventoHistorial {
  id: number;
  fecha: string;
  fenomeno: string;
  sensorName: string;
  community: string;
  severity: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo';
  mensaje: string;
  estado: 'Resuelta';
}

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [],
  styleUrl: './alertas.scss',
  templateUrl: './alertas.html',
})
export class Alertas {
  alertas: Alerta[] = [];
  mensaje = '';

  constructor() {
    this.cargarAlertas();
  }

  private cargarAlertas(): void {
    const guardadas = localStorage.getItem('climateguard_alertas');

    if (guardadas) {
      this.alertas = JSON.parse(guardadas);
      return;
    }

    this.alertas = [
      {
        alertId: 1,
        sensorName: 'Sensor de temperatura',
        community: 'Comunidad El Progreso',
        severity: 'Naranja',
        phenomenon: 'Incendio forestal',
        message: 'Temperatura elevada y humedad baja',
        createdAt: '07/10/2026 10:25'
      },
      {
        alertId: 2,
        sensorName: 'Sensor de río',
        community: 'Comunidad Las Flores',
        severity: 'Rojo',
        phenomenon: 'Inundación',
        message: 'Nivel del río por encima del rango seguro',
        createdAt: '07/10/2026 09:48'
      },
      {
        alertId: 3,
        sensorName: 'Sensor de viento',
        community: 'Comunidad Las Flores',
        severity: 'Amarillo',
        phenomenon: 'Tormenta',
        message: 'Ráfagas de viento en aumento',
        createdAt: '07/10/2026 08:32'
      }
    ];

    this.guardarAlertas();
  }

  resolver(alerta: Alerta): void {
    this.alertas = this.alertas.filter(
      item => item.alertId !== alerta.alertId
    );

    this.guardarAlertas();
    this.enviarAHistorial(alerta);

    this.mensaje = `Alerta de ${alerta.phenomenon} resuelta correctamente.`;
  }

  private enviarAHistorial(alerta: Alerta): void {
    const historialGuardado =
      localStorage.getItem('climateguard_historial');

    const historial: EventoHistorial[] =
      historialGuardado
        ? JSON.parse(historialGuardado)
        : [];

    const nuevoEvento: EventoHistorial = {
      id:
        historial.length > 0
          ? Math.max(...historial.map(item => item.id)) + 1
          : 1,
      fecha: new Date().toLocaleString('es-GT'),
      fenomeno: alerta.phenomenon,
      sensorName: alerta.sensorName,
      community: alerta.community,
      severity: alerta.severity,
      mensaje: alerta.message,
      estado: 'Resuelta'
    };

    historial.unshift(nuevoEvento);

    localStorage.setItem(
      'climateguard_historial',
      JSON.stringify(historial)
    );
  }

  private guardarAlertas(): void {
    localStorage.setItem(
      'climateguard_alertas',
      JSON.stringify(this.alertas)
    );
  }
}