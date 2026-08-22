import { Component } from '@angular/core';

interface Alerta {
  alertId: number;
  sensorName: string;
  community: string;
  severity: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo';
  phenomenon: string;
  message: string;
}

@Component({
  imports: [],
  selector: 'app-alertas',
  styleUrl: './alertas.scss',
  templateUrl: './alertas.html',
})
export class Alertas {
  alertas: Alerta[] = [
    { alertId: 1, sensorName: 'Sensor de temperatura', community: 'Comunidad El Progreso', severity: 'Naranja', phenomenon: 'IncendioForestal', message: 'Temperatura elevada y humedad baja' },
    { alertId: 2, sensorName: 'Sensor de río', community: 'Comunidad Las Flores', severity: 'Rojo', phenomenon: 'Inundacion', message: 'Nivel de río por encima del rango seguro' },
    { alertId: 3, sensorName: 'Sensor de viento', community: 'Comunidad Las Flores', severity: 'Amarillo', phenomenon: 'Tormenta', message: 'Ráfagas de viento en aumento' },
  ];
}