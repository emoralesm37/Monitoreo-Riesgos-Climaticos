import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Sensor {
  sensorId: number;
  name: string;
  sensorTypeId: number;
  sensorType: string;
  unit: string;
  communityId: number;
  community: string;
  isActive: boolean;
  lastValue: number | null;
  lastUpdatedAt: string | null;
}

export interface CreateSensorRequest {
  name: string;
  sensorTypeId: number;
  communityId: number;
}

@Injectable({ providedIn: 'root' })
export class SensoresService {
  private baseUrl = `${environment.apiUrl}/sensors`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Sensor[]> {
    return this.http.get<Sensor[]>(this.baseUrl);
  }

  getById(id: number): Observable<Sensor> {
    return this.http.get<Sensor>(`${this.baseUrl}/${id}`);
  }

  create(data: CreateSensorRequest): Observable<Sensor> {
    return this.http.post<Sensor>(this.baseUrl, data);
  }

  changeStatus(id: number, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/status`, { isActive });
  }

  reset(id: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/reset`, {});
  }
}