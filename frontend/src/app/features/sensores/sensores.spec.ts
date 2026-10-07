import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Sensores } from './sensores';
import { Auth } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

describe('Sensores', () => {
  let http: HttpTestingController;
  let role: string;
  const api = environment.apiUrl;

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
});
