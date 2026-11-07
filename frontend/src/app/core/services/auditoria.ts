import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuditEvent {
  event_id: string; occurred_at: string; actor_id: string | null;
  actor_name: string; actor_role: string; module: string; action: string;
  entity_id: string | null; result: 'CONFIRMED' | 'FAILED' | 'UNKNOWN'; http_status: number;
}
export interface AuditPage { items: AuditEvent[]; total: number; page: number; page_size: number; }
export interface AuditFilters { module: string; action: string; actor: string; start: string; end: string; result: string; }

@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);
  query(page: number, filters: AuditFilters) {
    let params = new HttpParams().set('page', page).set('page_size', 25);
    Object.entries(filters).forEach(([key, value]) => { if (value) params = params.set(key, value); });
    return this.http.get<AuditPage>(`${environment.apiUrl}/audit/events`, { params }).pipe(timeout(15000));
  }
}
