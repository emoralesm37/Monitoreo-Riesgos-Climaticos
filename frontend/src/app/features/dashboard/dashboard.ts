import {
  ChangeDetectorRef,
  Component,
  OnInit,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface EventoHistorial {
  id: number;
  fecha: string;
  fenomeno: string;
  sensorName: string;
  community: string;
  severity: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo';
  mensaje?: string;
  estado?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly apiUrl = '/api';

  totalSensores = 0;
  totalComunidades = 0;
  alertasActivas = 0;
  eventosHistorial = 0;

  ultimosEventos: EventoHistorial[] = [];

  cargandoSensores = true;
  cargandoComunidades = true;

  errorSensores = false;
  errorComunidades = false;

  ngOnInit(): void {
    this.cargarDashboard();
  }

  cargarDashboard(): void {
    this.cargarSensores();
    this.cargarComunidades();
    this.cargarAlertas();
    this.cargarHistorial();
  }

  private cargarSensores(): void {
    this.http
      .get<any[]>(`${this.apiUrl}/sensors`)
      .subscribe({
        next: (sensores) => {
          this.totalSensores = sensores.length;
          this.cargandoSensores = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error cargando sensores:', error);

          this.totalSensores = 0;
          this.cargandoSensores = false;
          this.errorSensores = true;

          this.cdr.detectChanges();
        }
      });
  }

  private cargarComunidades(): void {
    this.http
      .get<any[]>(`${this.apiUrl}/communities`)
      .subscribe({
        next: (comunidades) => {
          this.totalComunidades = comunidades.length;
          this.cargandoComunidades = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error cargando comunidades:', error);

          this.totalComunidades = 0;
          this.cargandoComunidades = false;
          this.errorComunidades = true;

          this.cdr.detectChanges();
        }
      });
  }

  private cargarAlertas(): void {
    const alertasGuardadas =
      localStorage.getItem('climateguard_alertas');

    if (alertasGuardadas) {
      try {
        const alertas = JSON.parse(alertasGuardadas);

        this.alertasActivas = Array.isArray(alertas)
          ? alertas.length
          : 0;
      } catch {
        this.alertasActivas = 0;
      }
    }

    this.cdr.detectChanges();
  }

  private cargarHistorial(): void {
    const historialGuardado =
      localStorage.getItem('climateguard_historial');

    if (!historialGuardado) {
      this.eventosHistorial = 0;
      this.ultimosEventos = [];
      return;
    }

    try {
      const historial: EventoHistorial[] =
        JSON.parse(historialGuardado);

      this.eventosHistorial = historial.length;

      this.ultimosEventos = historial.slice(0, 5);
    } catch {
      this.eventosHistorial = 0;
      this.ultimosEventos = [];
    }

    this.cdr.detectChanges();
  }
}