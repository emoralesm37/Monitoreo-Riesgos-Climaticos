import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Sensores } from './sensores';
import { Auth } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import { Sensor } from '../../core/services/sensores';

describe('Sensores', () => {
  let http: HttpTestingController;
  let role: string;
  const api = environment.apiUrl;
  const sensor: Sensor = { sensorId: 12, name: 'Sensor norte', sensorTypeId: 1,
    sensorType: 'Temperatura', communityId: 8, community: 'El Progreso', unit: 'C',
    isActive: false, lastValue: null, lastUpdatedAt: null };

  beforeEach(() => {
    role = 'Administrador';
    TestBed.configureTestingModule({
      imports: [Sensores],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: Auth, useValue: { getCurrentUser: () => ({ role }) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function start() {
    const fixture = TestBed.createComponent(Sensores);
    fixture.detectChanges();
    http.expectOne(`${api}/sensors`).flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the empty state and keeps the form outside the header', () => {
    const fixture = start();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay sensores');
    fixture.componentInstance.toggleForm();
    http.expectOne(`${api}/communities`).flush([]);
    http.expectOne(`${api}/catalogs/sensor-types`).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sensores-header form')).toBeNull();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
  });

  it('submits actual catalog IDs and preserves input when the API rejects creation', () => {
    const fixture = start();
    const component = fixture.componentInstance;
    component.toggleForm();
    http.expectOne(`${api}/communities`).flush([{ communityId: 8, name: 'El Progreso' }]);
    http.expectOne(`${api}/catalogs/sensor-types`).flush([{ sensorTypeId: 2, code: 'Humedad', unit: '%' }]);
    component.newSensor = { name: '  Sensor norte  ', communityId: 8, sensorTypeId: 2 };
    component.submitNewSensor();
    const request = http.expectOne(`${api}/sensors`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'Sensor norte', communityId: 8, sensorTypeId: 2 });
    request.flush({ message: 'La comunidad ya no existe.' }, { status: 400, statusText: 'Bad Request' });
    expect(component.formError).toBe('La comunidad ya no existe.');
    expect(component.showForm).toBe(true);
    expect(component.newSensor.name).toBe('  Sensor norte  ');
    expect(component.error).toBe('');
  });

  it('allows operators to manage sensors and hides creation from consultation users', () => {
    role = 'Operador';
    const operatorFixture = start();
    expect(operatorFixture.componentInstance.canManage).toBe(true);
    operatorFixture.destroy();
    role = 'Usuario de consulta';
    const fixture = start();
    fixture.componentInstance.toggleForm();
    fixture.componentInstance.submitNewSensor();
    expect(fixture.componentInstance.showForm).toBe(false);
    expect(fixture.nativeElement.querySelector('.sensores-header button')).toBeNull();
    http.expectNone(`${api}/sensors`);
    http.expectNone(`${api}/communities`);
  });

  it('lets consultation users open readings and renders newest first, including zero', () => {
    role = 'Usuario de consulta';
    const fixture = TestBed.createComponent(Sensores);
    fixture.detectChanges();
    http.expectOne(`${api}/sensors`).flush([sensor]);
    fixture.detectChanges();
    const button = [...fixture.nativeElement.querySelectorAll('button')].find(
      (element: any) => element.textContent.includes('Ver lecturas')) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando lecturas');
    const request = http.expectOne(`${api}/sensors/12/readings?limit=100`);
    expect(request.request.method).toBe('GET');
    request.flush([
      { sensorReadingId: 1, sensorId: 12, value: 25, timestamp: '2026-11-04T10:00:00Z' },
      { sensorReadingId: 2, sensorId: 12, value: 0, timestamp: '2026-11-04T11:00:00Z' },
    ]);
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.readings-panel');
    expect(panel.textContent).toContain('Sensor norte');
    expect(panel.textContent).toContain('Unidad: C');
    expect(panel.textContent).toContain('No es el historial completo');
    const rows = panel.querySelectorAll('tbody tr');
    expect(rows[0].cells[1].textContent.trim()).toBe('0');
    expect(rows[1].cells[1].textContent.trim()).toBe('25');
  });

  it('shows errors with retry and refreshes empty readings without inferring disconnection', () => {
    const fixture = start();
    fixture.componentInstance.viewReadings(sensor);
    http.expectOne(`${api}/sensors/12/readings?limit=100`).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.readings-panel [role="alert"]').textContent).toContain('No se pudieron cargar');
    fixture.nativeElement.querySelector('.readings-panel .btn-link').click();
    http.expectOne(`${api}/sensors/12/readings?limit=100`).flush([]);
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.readings-panel');
    expect(panel.textContent).toContain('No hay lecturas registradas');
    expect(panel.textContent).not.toContain('desconectado');
    panel.querySelector('.btn-primary').click();
    http.expectOne(`${api}/sensors/12/readings?limit=100`).flush([]);
    fixture.detectChanges();
    expect(fixture.componentInstance.readingsLoading).toBe(false);
  });

  it('retries the same pending reading without creating another measurement', () => {
    const fixture = start();
    fixture.componentInstance.viewReadings(sensor);
    http.expectOne(`${api}/sensors/12/readings?limit=100`).flush([
      { sensorReadingId: 7, sensorId: 12, value: 0, timestamp: '2026-11-06T00:00:00Z', alertEvaluationPending: true },
    ]);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.readings-table button') as HTMLButtonElement;
    expect(button.textContent).toContain('Reintentar'); button.click();
    const request = http.expectOne(`${api}/sensors/12/readings/7/evaluate`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ sensorReadingId: 7, alertEvaluationPending: false });
    fixture.detectChanges();
    expect(fixture.componentInstance.readings[0].alertEvaluationPending).toBe(false);
    expect(fixture.nativeElement.querySelector('.readings-table button')).toBeNull();
    http.expectNone(`${api}/sensors/12/readings/manual`);
  });
  it('cancels an older request when selecting another sensor', () => {
    const fixture = start();
    fixture.componentInstance.viewReadings(sensor);
    const previous = http.expectOne(`${api}/sensors/12/readings?limit=100`);
    fixture.componentInstance.viewReadings({ ...sensor, sensorId: 13, name: 'Sensor sur' });
    expect(previous.cancelled).toBe(true);
    http.expectOne(`${api}/sensors/13/readings?limit=100`).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#readings-title').textContent).toContain('Sensor sur');
  });
});
