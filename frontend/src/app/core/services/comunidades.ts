import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Comunidad {
  communityId: number;
  name: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface CrearComunidadRequest {
  name: string;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ActualizarComunidadRequest {
  name: string;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class ComunidadesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/communities';

  obtenerTodas(): Observable<Comunidad[]> {
    return this.http.get<Comunidad[]>(this.apiUrl);
  }

  obtenerPorId(id: number): Observable<Comunidad> {
    return this.http.get<Comunidad>(`${this.apiUrl}/${id}`);
  }

  crear(data: CrearComunidadRequest): Observable<Comunidad> {
    return this.http.post<Comunidad>(this.apiUrl, data);
  }

  actualizar(id: number, data: ActualizarComunidadRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, data);
  }
}