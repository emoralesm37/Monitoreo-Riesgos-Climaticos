import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Reglas, Regla } from './reglas';
import { environment } from '../../../environments/environment';

const payload = { name: 'Riesgo de helada', sensorTypeId: 1, minimumValue: -5,
  maximumValue: 0, alertSeverityId: 2, phenomenonTypeId: 4, message: 'Temperatura baja' };
const rule: Regla = { ...payload, alertRuleId: 7, sensorTypeCode: 'Temperatura',
  sensorTypeUnit: 'C', alertSeverityName: 'Amarillo', phenomenonTypeName: 'Helada', isActive: true };

describe('Reglas conectadas a la API', () => {
  let http: HttpTestingController;
  const api = environment.apiUrl;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Reglas], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function flushList(data: Regla[] = []) {
    http.expectOne(`${api}/alert-rules`).flush(data);
    http.expectOne(`${api}/catalogs/sensor-types`).flush([{ sensorTypeId: 1, code: 'Temperatura', unit: 'C' }]);
  }
  function start() {
    const fixture = TestBed.createComponent(Reglas);
    fixture.detectChanges();
    flushList();
    fixture.detectChanges();
    return fixture;
  }
  it('muestra una lista vacía sin insertar reglas de demostración', () => {
    const fixture = start();
    expect(fixture.componentInstance.reglas()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No hay reglas registradas en el servidor');
  });
  it('crea con el contrato real y vuelve a consultar el servidor', () => {
    const component = start().componentInstance;
    component.nuevaRegla();
    component.formulario = { ...payload };
    component.guardar();
    const req = http.expectOne(`${api}/alert-rules`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(rule);
    flushList([rule]);
    expect(component.reglas()[0].alertRuleId).toBe(7);
    expect(component.mostrarFormulario()).toBe(false);
  });
  it('rechaza un rango invertido antes de enviarlo', () => {
    const component = start().componentInstance;
    component.formulario = { ...payload, minimumValue: 10, maximumValue: 5 };
    component.guardar();
    expect(component.errorFormulario()).toContain('mínimo menor');
    http.expectNone(`${api}/alert-rules`);
  });
  it('edita con PUT y conserva el formulario ante un error del servidor', () => {
    const component = start().componentInstance;
    component.editar(rule);
    component.guardar();
    const req = http.expectOne(`${api}/alert-rules/7`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ detail: 'Ya existe una regla con ese nombre.' }, { status: 400, statusText: 'Bad Request' });
    expect(component.mostrarFormulario()).toBe(true);
    expect(component.formulario.name).toBe(payload.name);
    expect(component.errorFormulario()).toContain('Ya existe');
    expect(component.guardando()).toBe(false);
  });
});
