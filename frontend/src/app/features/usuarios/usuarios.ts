import { Component } from '@angular/core';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'Admin' | 'Operador';
}

interface BitacoraLog {
  id: number;
  fecha: string;
  usuario: string;
  accion: string;
}

@Component({
  imports: [],
  selector: 'app-usuarios',
  styleUrl: './usuarios.scss',
  templateUrl: './usuarios.html',
})
export class Usuarios {
  usuarios: Usuario[] = [
    { id: 1, nombre: 'Gerardo García', email: 'gerardo@climateguard.com', rol: 'Admin' },
    { id: 2, nombre: 'María López', email: 'maria@climateguard.com', rol: 'Operador' },
  ];

  bitacora: BitacoraLog[] = [
    { id: 1, fecha: '20/08/2026 15:10', usuario: 'Gerardo García', accion: 'Desactivó el sensor de viento' },
    { id: 2, fecha: '20/08/2026 14:32', usuario: 'María López', accion: 'Resolvió alerta de temperatura' },
  ];
}