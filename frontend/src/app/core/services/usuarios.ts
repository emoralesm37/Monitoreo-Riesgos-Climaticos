import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Usuario {
  id: string;
  name: string;
  email: string;
  roleId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Rol { id: string; name: string; description: string | null; permissions?: { method: string; path: string; label?: string }[]; }
export interface CrearUsuario { name: string; email: string; password: string; roleId: string; }
export interface EditarUsuario { name?: string; email?: string; roleId?: string; }

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;
  getAll() { return this.http.get<Usuario[]>(`${this.api}/users`).pipe(timeout(15000)); }
  getRoles() { return this.http.get<Rol[]>(`${this.api}/roles`).pipe(timeout(15000)); }
  create(request: CrearUsuario) { return this.http.post<Usuario>(`${this.api}/users`, request).pipe(timeout(15000)); }
  update(id: string, request: EditarUsuario) {
    return this.http.patch<Usuario>(`${this.api}/users/${encodeURIComponent(id)}`, request).pipe(timeout(15000));
  }
  changeStatus(id: string, isActive: boolean) {
    return this.http.patch<Usuario>(`${this.api}/users/${encodeURIComponent(id)}/status`, { isActive }).pipe(timeout(15000));
  }
}
