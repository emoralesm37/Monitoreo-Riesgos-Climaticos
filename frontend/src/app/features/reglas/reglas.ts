import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Regla {
  id: number;
  nombre: string;
  tipoSensor: string;
  comunidad: string;
  operador: '>' | '<' | '>=' | '<=';
  valor: number;
  severidad: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo';
  activa: boolean;
}

@Component({
  selector: 'app-reglas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reglas.html',
  styleUrl: './reglas.scss'
})
export class Reglas {
  reglas: Regla[] = [];

  mostrarFormulario = false;
  editandoId: number | null = null;

  nombre = '';
  tipoSensor = 'Temperatura';
  comunidad = 'Comunidad El Progreso';
  operador: '>' | '<' | '>=' | '<=' = '>';
  valor: number | null = null;
  severidad: 'Verde' | 'Amarillo' | 'Naranja' | 'Rojo' = 'Amarillo';

  mensaje = '';
  error = '';

  constructor() {
    this.cargarReglas();
  }

  private cargarReglas(): void {
    const guardadas = localStorage.getItem('climateguard_reglas');

    if (guardadas) {
      this.reglas = JSON.parse(guardadas);
      return;
    }

    this.reglas = [
      {
        id: 1,
        nombre: 'Temperatura elevada',
        tipoSensor: 'Temperatura',
        comunidad: 'Comunidad El Progreso',
        operador: '>=',
        valor: 35,
        severidad: 'Naranja',
        activa: true
      },
      {
        id: 2,
        nombre: 'Nivel crítico de río',
        tipoSensor: 'Nivel de río',
        comunidad: 'Comunidad Las Flores',
        operador: '>=',
        valor: 2.5,
        severidad: 'Rojo',
        activa: true
      }
    ];

    this.guardarReglas();
  }

  nuevaRegla(): void {
    this.limpiarFormulario();
    this.mostrarFormulario = true;
  }

  editar(regla: Regla): void {
    this.editandoId = regla.id;
    this.nombre = regla.nombre;
    this.tipoSensor = regla.tipoSensor;
    this.comunidad = regla.comunidad;
    this.operador = regla.operador;
    this.valor = regla.valor;
    this.severidad = regla.severidad;

    this.mostrarFormulario = true;
    this.mensaje = '';
    this.error = '';
  }

  guardar(): void {
    this.mensaje = '';
    this.error = '';

    if (this.nombre.trim().length < 3) {
      this.error = 'El nombre debe tener al menos 3 caracteres.';
      return;
    }

    if (this.valor === null) {
      this.error = 'Debes ingresar un valor de umbral.';
      return;
    }

    if (this.editandoId !== null) {
      const regla = this.reglas.find(
        item => item.id === this.editandoId
      );

      if (!regla) {
        this.error = 'La regla no fue encontrada.';
        return;
      }

      regla.nombre = this.nombre.trim();
      regla.tipoSensor = this.tipoSensor;
      regla.comunidad = this.comunidad;
      regla.operador = this.operador;
      regla.valor = this.valor;
      regla.severidad = this.severidad;

      this.mensaje = 'Regla actualizada correctamente.';
    } else {
      const nueva: Regla = {
        id: this.obtenerNuevoId(),
        nombre: this.nombre.trim(),
        tipoSensor: this.tipoSensor,
        comunidad: this.comunidad,
        operador: this.operador,
        valor: this.valor,
        severidad: this.severidad,
        activa: true
      };

      this.reglas.push(nueva);

      this.mensaje = 'Regla creada correctamente.';
    }

    this.guardarReglas();
    this.cerrarFormulario();
  }

  cambiarEstado(regla: Regla): void {
    regla.activa = !regla.activa;
    this.guardarReglas();

    this.mensaje = regla.activa
      ? 'Regla activada correctamente.'
      : 'Regla desactivada correctamente.';
  }

  cancelar(): void {
    this.cerrarFormulario();
    this.error = '';
  }

  private guardarReglas(): void {
    localStorage.setItem(
      'climateguard_reglas',
      JSON.stringify(this.reglas)
    );
  }

  private obtenerNuevoId(): number {
    if (this.reglas.length === 0) {
      return 1;
    }

    return Math.max(...this.reglas.map(regla => regla.id)) + 1;
  }

  private cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.limpiarFormulario();
  }

  private limpiarFormulario(): void {
    this.editandoId = null;
    this.nombre = '';
    this.tipoSensor = 'Temperatura';
    this.comunidad = 'Comunidad El Progreso';
    this.operador = '>';
    this.valor = null;
    this.severidad = 'Amarillo';
  }
}