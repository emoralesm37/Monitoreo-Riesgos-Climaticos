import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// AlertResponse: feature/fase3-alert-rules, commit 54b9ef9.
export interface Alerta {
  alertId: number;
  sensorId: number | null;
  communityId: number | null;
  sensorName: string | null;
  communityName: string | null;
  severity: 'VERDE' | 'AMARILLO' | 'NARANJA' | 'ROJO';
  phenomenon: 'INUNDACION' | 'SEQUIA' | 'TORMENTA' | 'HELADA' | 'INCENDIO_FORESTAL' | 'SISTEMA' | null;
  triggerValue: number | null;
  message: string;
  status: 'ACTIVA' | 'RESUELTA';
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  measurementId?: string | null;
  ruleId?: number | null;
  unit?: string | null;
  capturedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly url = `${environment.apiUrl}/alerts`;
  constructor(private http: HttpClient) {}
  getActive() {
    return this.http.get<Alerta[]>(this.url, { params: { status: 'ACTIVA' } });
  }
  query(params: Record<string, string>) {
    return this.http.get<Alerta[]>(this.url, { params });
  }
  getById(id: number) { return this.http.get<Alerta>(`${this.url}/${id}`); }
  resolve(id: number) {
    return this.http.patch<Alerta>(`${this.url}/${id}/resolve`, {});
  }
}
