import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Alertas } from './alertas';
import { Alerta } from '../../core/services/alertas';
import { Auth } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

describe('Alertas API', () => {
  let http: HttpTestingController;
  let role: string;
  const url = `${environment.apiUrl}/alerts`;
  const alert: Alerta = { alertId: 5, sensorId: 12, communityId: 8, sensorName: 'Sensor norte',
    communityName: 'Comunidad norte', severity: 'ROJO', phenomenon: 'INUNDACION', triggerValue: 0,
    message: 'Nivel alto', status: 'ACTIVA', createdAt: '2026-11-05T10:00:00Z',
    resolvedAt: null, resolvedByUserId: null };
  beforeEach(() => {
    role = 'ADMIN';
    TestBed.configureTestingModule({ imports: [Alertas], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: Auth, useValue: { getCurrentUser: () => ({ role }) } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function start() {
    const fixture = TestBed.createComponent(Alertas);
    fixture.detectChanges();
    return fixture;
  }
  it('requests active alerts through the configured API and renders actual response', () => {
    const fixture = start();
    expect(fixture.nativeElement.textContent).toContain('Cargando alertas');
    const req = http.expectOne(`${url}?status=ACTIVA`);
    expect(req.request.method).toBe('GET');
    req.flush([alert]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sensor norte');
    expect(fixture.nativeElement.textContent).toContain('Comunidad norte');
    expect(fixture.nativeElement.textContent).toContain('Inundación');
    expect(fixture.nativeElement.querySelector('.alerta-card').className).toContain('severity-rojo');
  });
  it('keeps the alert on failed resolution and removes it only on server success', () => {
    const fixture = start(); http.expectOne(`${url}?status=ACTIVA`).flush([alert]);
    fixture.componentInstance.resolver(alert);
    fixture.componentInstance.resolver(alert);
    const req = http.expectOne(`${url}/5/resolve`);
    expect(req.request.method).toBe('PATCH');
    req.flush({}, { status: 403, statusText: 'Forbidden' }); fixture.detectChanges();
    expect(fixture.componentInstance.alertas.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Tu rol no tiene permiso');
    fixture.componentInstance.resolver(alert);
    http.expectOne(`${url}/5/resolve`).flush({ ...alert, status: 'RESUELTA' }); fixture.detectChanges();
    expect(fixture.componentInstance.alertas.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Alerta resuelta en el servidor');
  });
  it('prevents viewers from resolving alerts', () => {
    role = 'VIEWER'; const fixture = start();
    http.expectOne(`${url}?status=ACTIVA`).flush([alert]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alerta-card button.btn-resolve')).toBeNull();
    fixture.componentInstance.resolver(alert); http.expectNone(`${url}/5/resolve`);
  });
  it('sends server filters and loads a real detail contract', () => {
    const fixture = start(); http.expectOne(`${url}?status=ACTIVA`).flush([]);
    fixture.componentInstance.statusFilter = 'RESUELTA';
    fixture.componentInstance.severityFilter = 'ROJO';
    fixture.componentInstance.sensorFilter = '12';
    fixture.componentInstance.load();
    http.expectOne(r => r.url === url && r.params.get('status') === 'RESUELTA'
      && r.params.get('severity') === 'ROJO' && r.params.get('sensorId') === '12')
      .flush([{ ...alert, status: 'RESUELTA' }]);
    fixture.componentInstance.detail(alert);
    http.expectOne(`${url}/5`).flush({ ...alert, status: 'RESUELTA', measurementId: 'sql:reading:1',
      ruleId: 1, capturedAt: alert.createdAt, unit: 'C' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.alert-detail').textContent).toContain('sql:reading:1');
    expect(fixture.componentInstance.selected?.status).toBe('RESUELTA');
    expect(fixture.nativeElement.querySelector('.alerta-card .btn-resolve')).toBeNull();
  });
  it('shows a service failure instead of a false empty state and retries', () => {
    const fixture = start();
    http.expectOne(`${url}?status=ACTIVA`).flush({}, { status: 503, statusText: 'Unavailable' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.no-alertas')).toBeNull();
    const retry = [...fixture.nativeElement.querySelectorAll('button')].find((b: any) => b.textContent.includes('Reintentar')) as HTMLButtonElement;
    retry.click(); http.expectOne(`${url}?status=ACTIVA`).flush([]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('El servicio no devolvió alertas activas');
  });
});
