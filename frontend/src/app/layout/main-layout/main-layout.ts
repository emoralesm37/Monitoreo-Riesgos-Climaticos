import { Component, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { catchError, exhaustMap, of, timer } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { Alerta, AlertasService } from '../../core/services/alertas';
@Component({
  imports: [RouterOutlet, RouterLink, Header, Sidebar],
  selector: 'app-main-layout',
  styleUrl: './main-layout.scss',
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly alertas = inject(AlertasService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly conocidas = new Set<number>();
  private inicializado = false;
  private temporizador?: ReturnType<typeof setTimeout>;
  aviso: Alerta | null = null;
  constructor() {
    timer(0, 5000).pipe(
      exhaustMap(() =>
        this.alertas.getActive().pipe(
          catchError(() => of(null))
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((alertas) => {
      if (!alertas) return;
      // Las alertas anteriores no generan avisos al abrir la web.
      if (!this.inicializado) {
        alertas.forEach(a => this.conocidas.add(a.alertId));
        this.inicializado = true;
        return;
      }
      const nuevas = alertas.filter(
        a => !this.conocidas.has(a.alertId)
      );
      alertas.forEach(a => this.conocidas.add(a.alertId));
      if (nuevas.length > 0) {
        this.mostrar(nuevas[0]);
      }
    });
    this.destroyRef.onDestroy(() => {
      if (this.temporizador) clearTimeout(this.temporizador);
    });
  }
  private mostrar(alerta: Alerta): void {
    this.aviso = alerta;
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.aviso = null;
    }, 12000);
  }
  cerrarAviso(): void {
    this.aviso = null;
    if (this.temporizador) clearTimeout(this.temporizador);
  }
}