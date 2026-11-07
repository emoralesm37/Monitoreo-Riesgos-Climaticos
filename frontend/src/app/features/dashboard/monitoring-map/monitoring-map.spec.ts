import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { vi } from 'vitest';
import { Comunidad } from '../../../core/services/comunidades';
import { communityPopup, hasCoordinates, MonitoringMap } from './monitoring-map';

const fake = vi.hoisted(() => {
  const map = { setView: vi.fn().mockReturnThis(), fitBounds: vi.fn(), invalidateSize: vi.fn(), remove: vi.fn() };
  const group = { addTo: vi.fn().mockReturnThis(), clearLayers: vi.fn() };
  const marker = { bindPopup: vi.fn().mockReturnThis(), bindTooltip: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis() };
  const tile = { on: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis() };
  return { map, group, marker, tile, tileLayer: vi.fn(() => tile), circleMarker: vi.fn(() => marker), createMap: vi.fn(() => map) };
});
vi.mock('leaflet', () => ({ map: fake.createMap, circleMarker: fake.circleMarker,
  latLngBounds: (coordinates: number[][]) => coordinates,
  layerGroup: () => fake.group, tileLayer: fake.tileLayer,
  control: { zoom: () => ({ addTo: vi.fn() }) } }));

const community: Comunidad = { communityId: 1, name: 'Comunidad de prueba unitaria', municipality: '',
  department: '', country: 'Guatemala', latitude: 15.2, longitude: -90.5,
  description: null, isActive: true, sensorCount: 0 };

describe('MonitoringMap (Leaflet isolated)', () => {
  beforeEach(() => { vi.clearAllMocks(); TestBed.configureTestingModule({ imports: [MonitoringMap] }); });
  it('rejects missing, non numeric and out of range coordinates, accepts zero', () => {
    expect(hasCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
    for (const latitude of [null, NaN, Infinity, 91, '15'])
      expect(hasCoordinates({ latitude, longitude: -90 } as any)).toBe(false);
    expect(hasCoordinates({ latitude: 15, longitude: null })).toBe(false);
    expect(hasCoordinates({ latitude: 15, longitude: -181 })).toBe(false);
  });
  it('renders untrusted popup names only as text and preserves zero sensor count', () => {
    const popup = communityPopup({ ...community, name: '<img src=x onerror=alert(1)>' });
    expect(popup.querySelector('img')).toBeNull();
    expect(popup.textContent).toContain('<img');
    expect(popup.textContent).toContain('Sensores asociados: 0');
    expect(popup.textContent).toContain('Riesgo: sin datos disponibles');
  });
  it('shows counts without inventing locations, neutral markers and destroys the map', async () => {
    const f = TestBed.createComponent(MonitoringMap);
    f.componentRef.setInput('communities', [community, { ...community, communityId: 2, latitude: null }]);
    f.detectChanges(); await f.whenStable(); f.detectChanges();
    await vi.waitFor(() => expect(fake.circleMarker).toHaveBeenCalled());
    expect(fake.tileLayer).toHaveBeenCalledWith('https://tile.openstreetmap.org/{z}/{x}/{y}.png', expect.objectContaining({
      referrerPolicy: 'origin',
      attribution: expect.stringContaining('https://www.openstreetmap.org/copyright'),
    }));
    expect(f.componentInstance.located.length).toBe(1);
    expect(f.nativeElement.textContent).toContain('registrada: 1');
    expect(fake.circleMarker).toHaveBeenCalledWith([15.2, -90.5], expect.objectContaining({ fillColor: '#1695b2' }));
    expect(fake.marker.bindTooltip.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
    f.componentInstance.showLocations();
    expect(fake.map.fitBounds).toHaveBeenCalledWith([[15.2,-90.5]], {padding:[25,25],maxZoom:11});
    f.componentRef.setInput('communities', []); f.detectChanges();
    expect(fake.group.clearLayers).toHaveBeenCalled();
    f.destroy(); expect(fake.map.remove).toHaveBeenCalledOnce();
  });
  it('distinguishes loading, API error, retry and no coordinates', async () => {
    const f = TestBed.createComponent(MonitoringMap); f.componentRef.setInput('loading', true);
    f.detectChanges(); await f.whenStable();
    expect(f.nativeElement.textContent).toContain('Consultando');
    f.componentRef.setInput('loading', false); f.componentRef.setInput('error', true); f.detectChanges();
    const retry = vi.fn(); f.componentInstance.retry.subscribe(retry);
    const buttons = [...f.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
    buttons.find(b => b.textContent?.includes('Reintentar'))!.click(); expect(retry).toHaveBeenCalledOnce();
    f.componentRef.setInput('error', false);
    f.componentRef.setInput('communities', [{ ...community, latitude: null }]); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Comunidades sin ubicación geográfica registrada:');
  });
  it('does not initialize Leaflet on the server', async () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const f = TestBed.createComponent(MonitoringMap); f.detectChanges(); await f.whenStable();
    expect(fake.createMap).not.toHaveBeenCalled(); f.destroy();
  });
  it('uses severity only from active alerts of the same community, never from resolved alerts', async () => {
    const f = TestBed.createComponent(MonitoringMap);
    f.componentRef.setInput('communities', [community]);
    f.componentRef.setInput('alertsAvailable', true);
    f.componentRef.setInput('alerts', [{communityId:1,status:'RESUELTA',severity:'ROJO'}, {communityId:2,status:'ACTIVA',severity:'ROJO'}]);
    f.detectChanges(); await f.whenStable();
    await vi.waitFor(() => expect(fake.circleMarker).toHaveBeenCalled());
    expect(fake.circleMarker).toHaveBeenLastCalledWith([15.2,-90.5], expect.objectContaining({fillColor:'#1695b2'}));
    f.componentRef.setInput('alerts', [{communityId:1,status:'ACTIVA',severity:'ROJO'}]); f.detectChanges();
    expect(fake.circleMarker).toHaveBeenLastCalledWith([15.2,-90.5], expect.objectContaining({fillColor:'#c94c66'}));
    expect(communityPopup(community, [], true).textContent).toContain('riesgo no confirmado');
    f.destroy();
  });
  it('warns about coordinates outside Guatemala without correcting or deleting them', () => {
    const f = TestBed.createComponent(MonitoringMap);
    f.componentRef.setInput('communities', [{...community,longitude:90.5}]);
    expect(f.componentInstance.outsideGuatemala).toBe(1);
    expect(f.componentInstance.located[0].longitude).toBe(90.5);
    f.destroy();
  });
});
