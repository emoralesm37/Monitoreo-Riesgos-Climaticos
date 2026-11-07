import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, TimeoutError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuditEvent, AuditoriaService } from '../../core/services/auditoria';

@Component({ selector: 'app-auditoria', standalone: true, imports: [FormsModule, DatePipe],
  templateUrl: './auditoria.html', styleUrl: './auditoria.scss' })
export class Auditoria implements OnInit {
  private readonly service = inject(AuditoriaService);
  private readonly destroyRef = inject(DestroyRef);
  readonly items = signal<AuditEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly total = signal(0);
  readonly detail = signal<AuditEvent | null>(null);
  page = 1;
  filters = { module: '', action: '', actor: '', start: '', end: '', result: '' };
  readonly modules = ['auth', 'users', 'communities', 'sensors', 'alerts', 'reports', 'alert-rules'];
  readonly actions = ['login', 'logout', 'create', 'update', 'delete', 'resolve', 'status', 'manual', 'reset'];
  ngOnInit() { this.load(); }
  load(page = this.page) {
    if (this.loading()) return;
    if (this.filters.actor && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.filters.actor)) {
      this.error.set('El actor debe ser un UUID de usuario v\u00e1lido.'); return;
    }
    if ([this.filters.start, this.filters.end].some(value => value && !Number.isFinite(new Date(value).getTime()))) {
      this.error.set('Revisa las fechas del filtro.'); return;
    }
    const start = this.filters.start ? new Date(this.filters.start).toISOString() : '';
    const end = this.filters.end ? new Date(this.filters.end).toISOString() : '';
    if (start && end && start > end) { this.error.set('La fecha inicial debe ser anterior a la final.'); return; }
    this.loading.set(true); this.error.set(''); this.detail.set(null);
    this.service.query(page, { ...this.filters, start, end }).pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))).subscribe({
      next: result => { this.items.set(result.items); this.total.set(result.total); this.page = result.page; },
      error: (error: HttpErrorResponse | TimeoutError) => this.error.set(error instanceof TimeoutError ?
        'La consulta tard\u00f3 demasiado. Puedes reintentar.' :
        error.status === 401 ? 'Sesi\u00f3n expirada. Inicia sesi\u00f3n nuevamente.' :
        error.status === 403 ? 'Solo Administrador puede consultar auditor\u00eda.' :
        error.status === 422 ? 'Revisa los filtros de fecha y actor.' :
        error.status === 0 ? 'Sin conexi\u00f3n con el Gateway. Puedes reintentar.' :
        'No se pudo consultar Audit Service. Los registros anteriores no se presentan como actualizados.')
    });
  }
  clear() { this.filters = { module: '', action: '', actor: '', start: '', end: '', result: '' }; this.load(1); }
  resultLabel(result: string) { return result === 'CONFIRMED' ? 'Confirmado' : result === 'FAILED' ? 'Fallido' : 'No confirmado'; }
}
