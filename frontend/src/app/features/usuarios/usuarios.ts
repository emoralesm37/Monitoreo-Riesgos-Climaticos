import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'Administrador' | 'Operador';
  activo: boolean;
}

interface BitacoraLog {
  id: number;
  fecha: string;
  usuario: string;
  accion: string;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './usuarios.scss',
  templateUrl: './usuarios.html',
})
export class Usuarios {

  usuarios: Usuario[] = [];

  bitacora: BitacoraLog[] = [];

  mostrarFormulario = false;
  editandoId: number | null = null;

  nombre = '';
  email = '';
  rol: 'Administrador' | 'Operador' = 'Operador';

  mensaje = '';
  error = '';

  constructor() {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    const usuariosGuardados = localStorage.getItem('climateguard_usuarios');
    const bitacoraGuardada = localStorage.getItem('climateguard_bitacora');

    if (usuariosGuardados) {
      this.usuarios = JSON.parse(usuariosGuardados);
    } else {
      this.usuarios = [
        {
          id: 1,
          nombre: 'Gerardo García',
          email: 'gerardo@climateguard.com',
          rol: 'Administrador',
          activo: true
        },
        {
          id: 2,
          nombre: 'María López',
          email: 'maria@climateguard.com',
          rol: 'Operador',
          activo: true
        }
      ];

      this.guardarUsuarios();
    }

    if (bitacoraGuardada) {
      this.bitacora = JSON.parse(bitacoraGuardada);
    } else {
      this.bitacora = [
        {
          id: 1,
          fecha: '20/08/2026 15:10',
          usuario: 'Gerardo García',
          accion: 'Desactivó el sensor de viento'
        },
        {
          id: 2,
          fecha: '20/08/2026 14:32',
          usuario: 'María López',
          accion: 'Resolvió alerta de temperatura'
        }
      ];

      this.guardarBitacora();
    }
  }

  nuevoUsuario(): void {
    this.limpiarFormulario();
    this.mostrarFormulario = true;
  }

  editar(usuario: Usuario): void {
    this.editandoId = usuario.id;
    this.nombre = usuario.nombre;
    this.email = usuario.email;
    this.rol = usuario.rol;

    this.mostrarFormulario = true;
    this.mensaje = '';
    this.error = '';
  }

  guardar(): void {
    this.mensaje = '';
    this.error = '';

    const nombreLimpio = this.nombre.trim();
    const emailLimpio = this.email.trim().toLowerCase();

    if (nombreLimpio.length < 3) {
      this.error = 'El nombre debe tener al menos 3 caracteres.';
      return;
    }

    if (!this.emailValido(emailLimpio)) {
      this.error = 'Ingresa un correo electrónico válido.';
      return;
    }

    const emailRepetido = this.usuarios.some(
      usuario =>
        usuario.email.toLowerCase() === emailLimpio &&
        usuario.id !== this.editandoId
    );

    if (emailRepetido) {
      this.error = 'Ya existe un usuario con ese correo electrónico.';
      return;
    }

    if (this.editandoId !== null) {
      const usuario = this.usuarios.find(
        item => item.id === this.editandoId
      );

      if (!usuario) {
        this.error = 'El usuario no fue encontrado.';
        return;
      }

      usuario.nombre = nombreLimpio;
      usuario.email = emailLimpio;
      usuario.rol = this.rol;

      this.registrarBitacora(
        'Administrador',
        `Actualizó al usuario ${usuario.nombre}`
      );

      this.mensaje = 'Usuario actualizado correctamente.';
    } else {
      const nuevoUsuario: Usuario = {
        id: this.obtenerNuevoId(),
        nombre: nombreLimpio,
        email: emailLimpio,
        rol: this.rol,
        activo: true
      };

      this.usuarios.push(nuevoUsuario);

      this.registrarBitacora(
        'Administrador',
        `Registró al usuario ${nuevoUsuario.nombre}`
      );

      this.mensaje = 'Usuario creado correctamente.';
    }

    this.guardarUsuarios();
    this.cerrarFormulario();
  }

  cambiarEstado(usuario: Usuario): void {
    usuario.activo = !usuario.activo;

    this.guardarUsuarios();

    this.registrarBitacora(
      'Administrador',
      `${usuario.activo ? 'Activó' : 'Desactivó'} al usuario ${usuario.nombre}`
    );

    this.mensaje = usuario.activo
      ? 'Usuario activado correctamente.'
      : 'Usuario desactivado correctamente.';
  }

  cancelar(): void {
    this.cerrarFormulario();
    this.error = '';
  }

  private cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.limpiarFormulario();
  }

  private limpiarFormulario(): void {
    this.editandoId = null;
    this.nombre = '';
    this.email = '';
    this.rol = 'Operador';
  }

  private obtenerNuevoId(): number {
    if (this.usuarios.length === 0) {
      return 1;
    }

    return Math.max(...this.usuarios.map(usuario => usuario.id)) + 1;
  }

  private registrarBitacora(usuario: string, accion: string): void {
    const ahora = new Date();

    const log: BitacoraLog = {
      id:
        this.bitacora.length > 0
          ? Math.max(...this.bitacora.map(item => item.id)) + 1
          : 1,
      fecha: ahora.toLocaleString('es-GT'),
      usuario,
      accion
    };

    this.bitacora.unshift(log);

    if (this.bitacora.length > 10) {
      this.bitacora = this.bitacora.slice(0, 10);
    }

    this.guardarBitacora();
  }

  private guardarUsuarios(): void {
    localStorage.setItem(
      'climateguard_usuarios',
      JSON.stringify(this.usuarios)
    );
  }

  private guardarBitacora(): void {
    localStorage.setItem(
      'climateguard_bitacora',
      JSON.stringify(this.bitacora)
    );
  }

  private emailValido(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}