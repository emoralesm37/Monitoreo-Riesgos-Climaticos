import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TimeoutError } from 'rxjs';
import { vi } from 'vitest';
import { AUTH_TIMEOUT_MS, Auth, LoginResponse } from './auth';
import { environment } from '../../../environments/environment';

export function sessionResponse(token = 'unit-access', refresh = 'unit-refresh'): LoginResponse {
  return { user: { id: 'unit-user', name: 'Unit user', email: 'admin@example.test', role: 'Administrador' },
    accessToken: token, refreshToken: refresh, tokenType: 'Bearer', expiresAt: new Date(Date.now() + 3600000).toISOString() };
}

describe('Auth real contract (HTTP isolated)', () => {
  let auth: Auth; let http: HttpTestingController;
  const api = `${environment.apiUrl}/auth`;
  const router = { url: '/dashboard', navigate: vi.fn().mockResolvedValue(true) };
  beforeEach(() => {
    sessionStorage.removeItem('climateguard_user'); router.navigate.mockClear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: router }] });
    http = TestBed.inject(HttpTestingController); auth = TestBed.inject(Auth);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); sessionStorage.removeItem('climateguard_user'); vi.useRealTimers(); });
  function login() {
    auth.login({ email: 'admin@example.test', password: 'unit-password' }).subscribe();
    http.expectOne(`${api}/login`).flush(sessionResponse());
  }
  it('stores the actual response and effective role', () => {
    login(); expect(auth.getToken()).toBe('unit-access'); expect(auth.getCurrentUser()?.role).toBe('Administrador');
  });
  it('does not store a rejected login', () => {
    const error = vi.fn(); auth.login({ email: 'admin@example.test', password: 'unit-password' }).subscribe({ error });
    http.expectOne(`${api}/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(error).toHaveBeenCalledOnce(); expect(auth.getToken()).toBeNull();
  });
  it('bounds login time and cancels an unresponsive request', async () => {
    vi.useFakeTimers(); const error = vi.fn();
    auth.login({ email: 'admin@example.test', password: 'unit-password' }).subscribe({ error });
    const request = http.expectOne(`${api}/login`);
    await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS);
    expect(error.mock.calls[0][0]).toBeInstanceOf(TimeoutError); expect(request.cancelled).toBe(true);
  });
  it('shares concurrent refresh requests and stores both rotated tokens', () => {
    login(); const first = vi.fn(), second = vi.fn();
    auth.refresh().subscribe(first); auth.refresh().subscribe(second);
    const request = http.expectOne(`${api}/refresh`);
    expect(request.request.body).toEqual({ refreshToken: 'unit-refresh' });
    request.flush(sessionResponse('next-access', 'next-refresh'));
    expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce(); expect(auth.getToken()).toBe('next-access');
    expect(JSON.parse(sessionStorage.getItem('climateguard_user')!).refreshToken).toBe('next-refresh');
  });
  it('refreshes an expired access session before authorizing navigation', () => {
    login(); const stored = JSON.parse(sessionStorage.getItem('climateguard_user')!); stored.expiresAt = Date.now() - 1;
    sessionStorage.setItem('climateguard_user', JSON.stringify(stored));
    const result = vi.fn(); auth.ensureSession().subscribe(result);
    http.expectOne(`${api}/refresh`).flush(sessionResponse('renewed'));
    expect(result).toHaveBeenCalledWith(true); expect(auth.getToken()).toBe('renewed');
  });
  it('ends a revoked refresh session and navigates to login', () => {
    login(); const error = vi.fn(); auth.refresh().subscribe({ error });
    http.expectOne(`${api}/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(error).toHaveBeenCalledOnce(); expect(auth.getCurrentUser()).toBeNull();
    expect(sessionStorage.getItem('climateguard_user')).toBeNull(); expect(router.navigate).toHaveBeenCalledOnce();
  });
  it('does not resurrect a session when refresh finishes after logout', () => {
    login(); auth.refresh().subscribe({ error: () => {} }); const pending = http.expectOne(`${api}/refresh`);
    auth.logout(); http.expectOne(`${api}/logout`).flush({ message: 'OK' });
    pending.flush(sessionResponse('late-access', 'late-refresh'));
    expect(auth.getToken()).toBeNull();
    const revoke = http.expectOne(`${api}/logout`); expect(revoke.request.body.refreshToken).toBe('late-refresh'); revoke.flush({});
  });
  it.each([{}, null])('rejects malformed successful responses: %s', body => {
    const error = vi.fn(); auth.login({ email: 'admin@example.test', password: 'unit-password' }).subscribe({ error });
    http.expectOne(`${api}/login`).flush(body);
    expect(error).toHaveBeenCalledOnce(); expect(auth.getToken()).toBeNull();
  });
});
