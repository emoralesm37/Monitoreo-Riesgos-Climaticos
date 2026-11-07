import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { Reportes } from './reportes';
import { ReportMetadata } from '../../core/services/reportes';
import { environment } from '../../../environments/environment';

describe('Reportes', () => {
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/reports`;
  const report: ReportMetadata = { _id: 'mongo-id', report_type: 'communities', user_id: 'user-id',
    created_at: '2026-11-05T12:00:00Z', parameters: {}, status: 'completed',
    file_name: 'comunidades.pdf', downloaded_at: null };
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Reportes], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  function start() {
    const fixture = TestBed.createComponent(Reportes);
    fixture.detectChanges();
    return fixture;
  }
  it('renders loading and a real empty response', () => {
    const fixture = start();
    expect(fixture.nativeElement.textContent).toContain('Consultando reportes');
    http.expectOne(`${url}/history?limit=50`).flush({ total: 0, reports: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Aún no hay reportes');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });
  it('uses snake_case and _id, sorts newest first and enables only completed files', () => {
    const fixture = start();
    http.expectOne(`${url}/history?limit=50`).flush({ total: 2, reports: [
      { ...report, _id: 'older', created_at: '2026-11-04T12:00:00Z', status: 'failed', file_name: null }, report] });
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('comunidades.pdf');
    expect(rows[0].textContent).toContain('05/11/2026');
    expect(rows[0].textContent).toContain('Completado');
    expect(rows[1].textContent).toContain('Fallido');
    expect(rows[1].querySelector('button')).toBeNull();
    expect(fixture.componentInstance.reports()[0]._id).toBe('mongo-id');
  });
  it('disables duplicate generation and reloads history only after success', () => {
    const fixture = start();
    http.expectOne(`${url}/history?limit=50`).flush({ total: 0, reports: [] });
    fixture.componentInstance.generate(); fixture.componentInstance.generate(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.primary').disabled).toBe(true);
    http.expectOne(`${url}/communities`).flush({ status: 'completed', report_id: report._id,
      file_name: report.file_name, message: 'OK' });
    http.expectOne(`${url}/history?limit=50`).flush({ total: 1, reports: [report] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Reporte generado: comunidades.pdf');
    expect(fixture.componentInstance.generating()).toBe(false);
  });
  it.each([[401, 'Tu sesión expiró'], [403, 'No tienes permiso'], [503, 'no está disponible']])(
    'handles HTTP %s without showing a false empty state and supports retry', (status, message) => {
      const fixture = start();
      http.expectOne(`${url}/history?limit=50`).flush({}, { status: status as number, statusText: 'Error' });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
      expect(fixture.nativeElement.querySelector('.empty')).toBeNull();
      const retry = [...fixture.nativeElement.querySelectorAll('button')].find((b: any) => b.textContent.includes('Reintentar')) as HTMLButtonElement;
      retry.click();
      http.expectOne(`${url}/history?limit=50`).flush({ total: 0, reports: [] });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Aún no hay reportes');
    });
  it('preserves history on failed generation without retrying POST automatically', () => {
    const fixture = start();
    http.expectOne(`${url}/history?limit=50`).flush({ total: 1, reports: [report] });
    fixture.componentInstance.generate();
    http.expectOne(`${url}/communities`).flush({}, { status: 502, statusText: 'Error' });
    fixture.detectChanges();
    expect(fixture.componentInstance.reports()).toEqual([report]);
    expect(fixture.componentInstance.generating()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    http.expectNone(`${url}/communities`);
  });
  it('downloads using _id, keeps server file name and releases the object URL', async () => {
    const create = vi.fn(() => 'blob:test');
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(class {}, { createObjectURL: create, revokeObjectURL: revoke }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fixture = start();
    http.expectOne(`${url}/history?limit=50`).flush({ total: 1, reports: [report] });
    fixture.componentInstance.download(report); fixture.componentInstance.download(report);
    const pdf = new Blob(['%PDF-test'], { type: 'application/pdf' });
    http.expectOne(`${url}/mongo-id/download`).flush(pdf);
    expect(create).toHaveBeenCalledWith(pdf);
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('comunidades.pdf');
    expect(fixture.componentInstance.downloading().size).toBe(0);
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
  it('keeps the report on download failure and allows retry', () => {
    const fixture = start();
    http.expectOne(`${url}/history?limit=50`).flush({ total: 1, reports: [report] });
    fixture.componentInstance.download(report);
    http.expectOne(`${url}/mongo-id/download`).flush(new Blob(), { status: 404, statusText: 'Not found' });
    expect(fixture.componentInstance.reports()).toEqual([report]);
    expect(fixture.componentInstance.downloading().size).toBe(0);
    fixture.componentInstance.download(report);
    http.expectOne(`${url}/mongo-id/download`).flush(new Blob(), { status: 403, statusText: 'Forbidden' });
    expect(fixture.componentInstance.actionError()).toContain('No tienes permiso');
  });
  function selectDataType(fixture: ReturnType<typeof start>, type: 'sensors' | 'readings') {
    const component = fixture.componentInstance;
    component.reportType = type; component.selectType();
    http.expectOne(`${environment.apiUrl}/sensors`).flush([{sensorId:1,name:'Real sensor'}]);
    http.expectOne(`${environment.apiUrl}/communities`).flush([{communityId:2,name:'Real community'}]);
    http.expectOne(`${environment.apiUrl}/catalogs/sensor-types`).flush([{sensorTypeId:3,code:'TEMP',unit:'C'}]);
    return component;
  }
  it('generates sensors using real filter IDs and preserves false activity', () => {
    const fixture = start();
    http.expectOne(`${url}/history?limit=50`).flush({total:0,reports:[]});
    const component = selectDataType(fixture, 'sensors');
    component.filters = {sensorId:1, communityId:2, isActive:false};
    component.generate();
    const req = http.expectOne(`${url}/sensors`);
    expect(req.request.body).toEqual({sensorId:1,communityId:2,isActive:false});
    req.flush({status:'completed',report_id:'id',file_name:'sensors.pdf',row_count:0});
    http.expectOne(`${url}/history?limit=50`).flush({total:1,reports:[{...report,report_type:'sensors',parameters:{isActive:false},row_count:0}]});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0 filas');
    expect(fixture.nativeElement.textContent).toContain('Activo: false');
  });
  it('converts local datetime filters to UTC and submits evaluation status', () => {
    const fixture = start(); http.expectOne(`${url}/history?limit=50`).flush({total:0,reports:[]});
    const component = selectDataType(fixture,'readings');
    component.startDate = '2026-11-06T08:00'; component.endDate = '2026-11-06T10:00';
    component.filters = {evaluationStatus:'pending'}; component.generate();
    const req = http.expectOne(`${url}/readings`);
    expect(req.request.body).toEqual({evaluationStatus:'pending',startDate:new Date(component.startDate).toISOString(),endDate:new Date(component.endDate).toISOString()});
    req.flush({}, {status:413,statusText:'Too Large'});
    expect(component.actionError()).toContain('20000');
    expect(component.generating()).toBe(false);
  });
  it('rejects reversed dates without creating persistent reports', () => {
    const fixture = start(); http.expectOne(`${url}/history?limit=50`).flush({total:0,reports:[]});
    const component = selectDataType(fixture,'readings');
    component.startDate='2026-11-07T00:00'; component.endDate='2026-11-06T00:00'; component.generate();
    http.expectNone(`${url}/readings`); expect(component.actionError()).toContain('fecha inicial');
  });
  it('loads a new page and filters history from the persistent API', () => {
    const fixture=start();http.expectOne(`${url}/history?limit=50`).flush({total:73,reports:[report]});
    fixture.componentInstance.page(1);
    http.expectOne(`${url}/history?limit=50&skip=50`).flush({total:73,reports:[]});
    fixture.componentInstance.historyType='readings';fixture.componentInstance.changeHistory();
    http.expectOne(`${url}/history?limit=50&report_type=readings`).flush({total:3,reports:[]});
    expect(fixture.componentInstance.offset()).toBe(0);
    expect(fixture.componentInstance.total()).toBe(3);
  });
});
