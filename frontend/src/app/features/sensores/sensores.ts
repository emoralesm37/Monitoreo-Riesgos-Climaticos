import { Component } from '@angular/core';

interface Sensor {
  sensorId: number;
  name: string;
  sensorType: string;
  unit: string;
  community: string;
  isActive: boolean;
  lastValue: number;
}

@Component({
  imports: [],
  selector: 'app-sensores',
  styleUrl: './sensores.scss',
  templateUrl: './sensores.html',
})
export class Sensores {
  sensores: Sensor[] = [
    { sensorId: 1, name: 'Sensor de temperatura', sensorType: 'Temperatura', unit: 'C', community: 'Comunidad El Progreso', isActive: true, lastValue: 28.5 },
    { sensorId: 2, name: 'Sensor de humedad', sensorType: 'Humedad', unit: '%', community: 'Comunidad El Progreso', isActive: true, lastValue: 62 },
    { sensorId: 3, name: 'Sensor de viento', sensorType: 'Viento', unit: 'km/h', community: 'Comunidad Las Flores', isActive: false, lastValue: 12 },
    { sensorId: 4, name: 'Sensor de río', sensorType: 'NivelRio', unit: 'm', community: 'Comunidad Las Flores', isActive: true, lastValue: 0.8 },
  ];
}