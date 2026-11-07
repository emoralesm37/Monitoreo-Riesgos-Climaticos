import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { forkJoin } from 'rxjs';
import { Sensor, SensorCommunity, SensorType } from './sensores';

export type ReportType = 'communities' | 'sensors' | 'readings' | 'alerts' | 'events' | 'sensor_status' | 'climate_statistics' | 'executive';
export interface ReportFilters {
  sensorId?: number;
  communityId?: number;
  sensorTypeId?: number;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  evaluationStatus?: 'delivered' | 'pending' | 'unrecorded';
  alertStatus?: 'ACTIVA' | 'RESUELTA';
  severity?: 'VERDE' | 'AMARILLO' | 'NARANJA' | 'ROJO';
  phenomenon?: 'INUNDACION' | 'SEQUIA' | 'TORMENTA' | 'HELADA' | 'INCENDIO_FORESTAL' | 'SISTEMA';
  staleAfterMinutes?: number;
  accumulationMode?: 'increments' | 'counter';
}

export type ReportStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface ReportMetadata {
  _id: string;
  report_type: string;
  user_id: string;
  created_at: string;
  parameters: Record<string, unknown>;
  status: ReportStatus;
  file_name: string | null;
  downloaded_at: string | null;
  row_count?: number;
}
export interface ReportHistory { total: number; reports: ReportMetadata[]; }
export interface GeneratedReport {
  status: 'completed';
  report_id: string;
  file_name: string;
  message: string;
  row_count?: number;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/reports`;

  generateCommunities() {
    return this.http.post<GeneratedReport>(`${this.url}/communities`, null);
  }
  generate(type: Exclude<ReportType, 'communities'>, filters: ReportFilters) {
    return this.http.post<GeneratedReport>(`${this.url}/${type}`, filters);
  }
  filterOptions() {
    return forkJoin({
      sensors: this.http.get<Sensor[]>(`${environment.apiUrl}/sensors`),
      communities: this.http.get<SensorCommunity[]>(`${environment.apiUrl}/communities`),
      types: this.http.get<SensorType[]>(`${environment.apiUrl}/catalogs/sensor-types`),
    });
  }
  history(skip = 0, type?: ReportType) {
    const params: Record<string, string | number> = { limit: 50 };
    if (skip) params['skip'] = skip;
    if (type) params['report_type'] = type;
    return this.http.get<ReportHistory>(`${this.url}/history`, { params });
  }
  download(id: string) {
    return this.http.get(`${this.url}/${encodeURIComponent(id)}/download`, { responseType: 'blob' });
  }
}
