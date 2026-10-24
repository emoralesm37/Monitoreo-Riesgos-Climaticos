import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Comunidad {
  communityId: number;
  name: string;
  municipality: string;
  department: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  isActive: boolean;
  sensorCount: number;
}

export interface CrearComunidadRequest {
  name: string;
  municipality: string;
  department: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
}

export interface ActualizarComunidadRequest
  extends CrearComunidadRequest {}

@Injectable({
  providedIn: 'root'
})
export class ComunidadesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/communities`;

  obtenerTodas(): Observable<Comunidad[]> {
    return this.http.get<Comunidad[]>(this.apiUrl);
  }

  obtenerPorId(id: number): Observable<Comunidad> {
    return this.http.get<Comunidad>(`${this.apiUrl}/${id}`);
  }

  crear(data: CrearComunidadRequest): Observable<Comunidad> {
    return this.http.post<Comunidad>(this.apiUrl, data);
  }

  actualizar(
    id: number,
    data: ActualizarComunidadRequest
  ): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, data);
  }
}
