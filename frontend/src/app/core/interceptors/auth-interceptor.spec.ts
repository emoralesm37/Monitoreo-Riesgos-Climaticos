import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { authInterceptor } from './auth-interceptor';
import { Auth, LoginResponse } from '../services/auth';
import { environment } from '../../../environments/environment';

describe('JWT interceptor and refresh (isolated HTTP)', () => {
  let http: HttpTestingController; let client: HttpClient; let auth: Auth;
  const api = environment.apiUrl;
  const router = { url: '/dashboard', navigate: vi.fn().mockResolvedValue(true) };
  const response = (token: string, refresh: string): LoginResponse => ({
    user: { id: 'unit', name: 'Unit', email: 'unit@example.test', role: 'Administrador' },
    accessToken: token, refreshToken: refresh, tokenType: 'Bearer', expiresAt: new Date(Date.now() + 3600000).toISOString() });
  beforeEach(() => {
    sessionStorage.removeItem('climateguard_user'); router.navigate.mockClear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), { provide: Router, useValue: router }] });
    http = TestBed.inject(HttpTestingController); client = TestBed.inject(HttpClient); auth = TestBed.inject(Auth);
    auth.login({ email: 'unit@example.test', password: 'unit-password' }).subscribe();
    http.expectOne(`${api}/auth/login`).flush(response('old-access', 'old-refresh'));
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); sessionStorage.removeItem('climateguard_user'); });
  it('sends Bearer only to Gateway API, not external URLs or auth endpoints', () => {
    client.get(`${api}/sensors`).subscribe();
    const req = http.expectOne(`${api}/sensors`); expect(req.request.headers.get('Authorization')).toBe('Bearer old-access'); req.flush([]);
    client.get('https://example.test/data').subscribe();
    const external = http.expectOne('https://example.test/data'); expect(external.request.headers.has('Authorization')).toBe(false); external.flush({});
  });
  it('shares one rotated refresh across simultaneous 401s and replays once', () => {
    client.get(`${api}/sensors`).subscribe(); client.get(`${api}/communities`).subscribe();
    http.expectOne(`${api}/sensors`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${api}/communities`).flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = http.expectOne(`${api}/auth/refresh`);
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(response('new-access', 'new-refresh'));
    for (const path of ['sensors', 'communities']) {
      const replay = http.expectOne(`${api}/${path}`); expect(replay.request.headers.get('Authorization')).toBe('Bearer new-access'); replay.flush([]);
    }
  });
  it('does not replay an old request under a replacement login session', () => {
    const error = vi.fn(); client.get(`${api}/sensors`).subscribe({ error });
    const pending = http.expectOne(`${api}/sensors`);
    auth.logout(); http.expectOne(`${api}/auth/logout`).flush({});
    auth.login({ email: 'unit@example.test', password: 'unit-password' }).subscribe();
    http.expectOne(`${api}/auth/login`).flush(response('replacement-access', 'replacement-refresh'));
    pending.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(error).toHaveBeenCalledOnce(); http.expectNone(`${api}/auth/refresh`);
    expect(auth.getToken()).toBe('replacement-access');
  });
  it('does not refresh on 403', () => {
    const error = vi.fn(); client.get(`${api}/users`).subscribe({ error });
    http.expectOne(`${api}/users`).flush({}, { status: 403, statusText: 'Forbidden' });
    http.expectNone(`${api}/auth/refresh`); expect(error).toHaveBeenCalledOnce(); expect(auth.isAuthenticated()).toBe(true);
  });
  it('stops after a rejected refresh instead of looping', () => {
    const error = vi.fn(); client.get(`${api}/sensors`).subscribe({ error });
    http.expectOne(`${api}/sensors`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${api}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(error).toHaveBeenCalledOnce(); expect(auth.getToken()).toBeNull(); http.expectNone(`${api}/sensors`);
  });
  it('does not try a second refresh if the replay still returns 401', () => {
    const error = vi.fn(); client.get(`${api}/sensors`).subscribe({ error });
    http.expectOne(`${api}/sensors`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${api}/auth/refresh`).flush(response('new-access', 'new-refresh'));
    http.expectOne(`${api}/sensors`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectNone(`${api}/auth/refresh`); expect(auth.getToken()).toBeNull(); expect(error).toHaveBeenCalledOnce();
  });
});
