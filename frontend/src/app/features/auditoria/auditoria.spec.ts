import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auditoria } from './auditoria';
import { environment } from '../../../environments/environment';

describe('Auditoria real API', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Auditoria], providers: [provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(Auditoria); fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, http: TestBed.inject(HttpTestingController) };
  }
  it('requests paginated events, never seeds local records and distinguishes empty', () => {
    const { component, http } = setup();
    const request = http.expectOne(`${environment.apiUrl}/audit/events?page=1&page_size=25`);
    expect(request.request.method).toBe('GET'); request.flush({ items: [], total: 0, page: 1, page_size: 25 });
    expect(component.items()).toEqual([]); expect(component.error()).toBe(''); expect(component.loading()).toBe(false); http.verify();
  });
  it('keeps a denied response as an error, allows retry and applies filters', () => {
    const { component, http } = setup();
    http.expectOne(r => r.url.endsWith('/audit/events')).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.error()).toContain('Administrador'); expect(component.loading()).toBe(false);
    component.filters.module = 'users'; component.load(1);
    const request = http.expectOne(r => r.params.get('module') === 'users');
    request.flush({ items: [], total: 0, page: 1, page_size: 25 }); expect(component.error()).toBe(''); http.verify();
  });
  it('does not send an invalid actor or date range and does not duplicate loading requests', () => {
    const { component, http } = setup(); component.load();
    const request = http.expectOne(r => r.url.endsWith('/audit/events')); request.flush({ items: [], total: 0, page: 1, page_size: 25 });
    component.filters.actor = 'invalid'; component.load(); expect(component.error()).toContain('UUID');
    component.filters.actor = ''; component.filters.start = '2026-11-06T12:00'; component.filters.end = '2026-11-05T12:00';
    component.load(); expect(component.error()).toContain('anterior'); http.expectNone(r => r.url.endsWith('/audit/events')); http.verify();
  });
});
