import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Dashboard, chartGeometry, readingPoints, utcTime } from './dashboard';
import { environment } from '../../../environments/environment';
import { Sensor, SensorReading } from '../../core/services/sensores';

const sensor = (id: number, communityId = 1): Sensor => ({sensorId:id, name:'Unit sensor '+id, communityId, community:'Unit community', sensorTypeId:1, sensorType:'Temperatura', unit:'C', isActive:false, lastValue:0, lastUpdatedAt:'2026-11-05T22:00:00'});
const reading = (id: number, value = 0): SensorReading => ({sensorReadingId:id, sensorId:1, value, timestamp:'2026-11-05T22:00:00'});
describe('Dashboard API metrics', () => {
  let http: HttpTestingController;
  const api = environment.apiUrl;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports:[Dashboard], providers:[provideHttpClient(),provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function start(sensors: Sensor[] = []) {
    const fixture = TestBed.createComponent(Dashboard); fixture.detectChanges();
    http.expectOne(`${api}/communities`).flush([]);
    http.expectOne(`${api}/sensors`).flush(sensors);
    return fixture;
  }
  it('counts active and resolved server alerts without infrastructure claims', () => {
    const f = start();
    http.expectOne(`${api}/alerts`).flush([
      {alertId:1,status:'ACTIVA',severity:'ROJO',createdAt:'2026-11-06T00:00:00Z'},
      {alertId:2,status:'RESUELTA',severity:'AMARILLO',createdAt:'2026-11-05T00:00:00Z'}]);
    f.detectChanges(); expect(f.componentInstance.activeAlerts.length).toBe(1);
    expect(f.componentInstance.resolvedAlerts.length).toBe(1);
    expect(f.componentInstance.recentAlerts[0].status).toBe('ACTIVA');
    expect(f.componentInstance.severityCount('AMARILLO')).toBe(0);
    expect(f.nativeElement.textContent).not.toContain('Operativa');
  });
  it('does not present connection failure as zero real alerts', () => {
    const f = start(); http.expectOne(`${api}/alerts`).flush({}, {status:503,statusText:'Unavailable'}); f.detectChanges();
    expect(f.componentInstance.alertError()).toContain('No disponible');
    expect(f.nativeElement.querySelector('[data-metric="active-alerts"]').textContent).not.toBe('0');
    expect(f.nativeElement.textContent).toContain('No disponible');
  });
  it('uses a typed selected-sensor sample and draws a single real zero without inventing a line', () => {
    const f = start([sensor(1)]);http.expectOne(`${api}/alerts`).flush([]);
    const r = http.expectOne(`${api}/sensors/1/readings?limit=100`);expect(r.request.method).toBe('GET');r.flush([reading(1)]);f.detectChanges();
    expect(f.componentInstance.activeSensors).toBe(0);expect(f.componentInstance.chart?.points[0].reading.value).toBe(0);
    expect(f.nativeElement.querySelectorAll('.series-point').length).toBe(1);
    expect(f.nativeElement.querySelector('.series-line')).toBeNull();
    expect(f.componentInstance.lastActivity).toBe(Date.parse('2026-11-05T22:00:00Z'));
  });
  it('cancels the previous sensor request instead of displaying a stale response', () => {
    const f = start([sensor(1),sensor(2)]);http.expectOne(`${api}/alerts`).flush([]);
    const old = http.expectOne(`${api}/sensors/1/readings?limit=100`);
    f.componentInstance.sensorId = '2';f.componentInstance.loadReadings();expect(old.cancelled).toBe(true);
    http.expectOne(`${api}/sensors/2/readings?limit=100`).flush([]);expect(f.componentInstance.readings()).toEqual([]);
  });
  it('does not infer disconnection from a readings failure and permits retry', () => {
    const f = start([sensor(1)]);http.expectOne(`${api}/alerts`).flush([]);
    http.expectOne(`${api}/sensors/1/readings?limit=100`).flush({}, {status:502,statusText:'Bad gateway'});
    expect(f.componentInstance.readingLoading()).toBe(false);expect(f.componentInstance.readingError()).toContain('no significa');
    f.componentInstance.loadReadings();http.expectOne(`${api}/sensors/1/readings?limit=100`).flush([reading(1)]);
    expect(f.componentInstance.readingError()).toBe('');
  });
  it('filters sensors and alerts by actual community IDs', () => {
    const f = start([sensor(1),sensor(2,2)]);
    http.expectOne(`${api}/sensors/1/readings?limit=100`).flush([]);
    http.expectOne(`${api}/alerts`).flush([{alertId:1,communityId:1,status:'ACTIVA',severity:'ROJO'},{alertId:2,communityId:2,status:'RESUELTA',severity:'ROJO'}]);
    f.componentInstance.communityId='2';f.componentInstance.selectCommunity();
    http.expectOne(`${api}/sensors/2/readings?limit=100`).flush([]);
    expect(f.componentInstance.visibleSensors.map(s=>s.sensorId)).toEqual([2]);expect(f.componentInstance.activeAlerts).toEqual([]);expect(f.componentInstance.resolvedAlerts.length).toBe(1);
  });
  it('prevents duplicate refreshes while the sources are loading', () => {
    const f = TestBed.createComponent(Dashboard);f.detectChanges();f.componentInstance.refresh();
    for(const path of ['sensors','communities','alerts'])http.expectOne(`${api}/${path}`).flush([]);
    expect(f.componentInstance.busy).toBe(false);
  });
});
describe('Reading chart calculations',()=>{
  it('sorts timestamps as UTC, preserves zero and rejects malformed data',()=>{
    const readings=[{...reading(2,5),timestamp:'2026-11-05T23:00:00Z'},reading(1),{...reading(3),timestamp:'bad'},reading(4,NaN)];
    expect(readingPoints(readings,'').map(r=>r.sensorReadingId)).toEqual([1,2]);
    expect(utcTime('2026-11-05T22:00:00')).toBe(utcTime('2026-11-05T22:00:00Z'));
  });
  it('uses actual elapsed time for x positions and filters only the received sample',()=>{
    const first={...reading(1),timestamp:'2026-11-05T00:00:00Z'},last={...reading(2,10),timestamp:'2026-11-05T02:00:00Z'};
    const middle={...reading(3,5),timestamp:'2026-11-05T00:30:00Z'};
    const points=chartGeometry(readingPoints([last,first,middle],''))!.points;
    expect(points[1].x-points[0].x).toBeCloseTo((points[2].x-points[0].x)/4);
    expect(readingPoints([first,last],'1',Date.parse('2026-11-05T02:00:00Z'))).toEqual([last]);
    expect(chartGeometry([])).toBeNull();
  });
});
