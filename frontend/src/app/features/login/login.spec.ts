import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';
import { Login } from './login';
import { AUTH_TIMEOUT_MS } from '../../core/services/auth';
import { environment } from '../../../environments/environment';

describe('Login UI', () => {
  let http: HttpTestingController;
  const router = { url: '/login', navigate: vi.fn().mockResolvedValue(true), navigateByUrl: vi.fn().mockResolvedValue(true) };
  const url = `${environment.apiUrl}/auth/login`;
  beforeEach(() => {
    sessionStorage.removeItem('climateguard_user'); router.navigateByUrl.mockClear();
    TestBed.configureTestingModule({ imports: [Login], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: Router, useValue: router }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); sessionStorage.removeItem('climateguard_user'); vi.useRealTimers(); });
  function start() {
    const f = TestBed.createComponent(Login);
    f.componentInstance.email = 'admin@example.test'; f.componentInstance.password = 'unit-password'; f.detectChanges();
    return f;
  }
  it('shows unconfigured OAuth without blocking local login or duplicate requests',async()=>{
    const f=start();f.componentInstance.oauth('google');f.componentInstance.oauth('google');
    const request=http.expectOne(`${environment.apiUrl}/auth/oauth/google/start`);expect(request.request.withCredentials).toBe(true);
    request.flush({}, {status:503,statusText:'Unavailable'});await f.whenStable();
    expect(f.componentInstance.errorMessage).toContain('no esta configurado');expect(f.componentInstance.isLoading).toBe(false);
    expect(f.componentInstance.password).toBe('unit-password');
  });
  it('validates input without sending a request', async () => {
    const f = start(); f.componentInstance.email = 'invalid'; f.componentInstance.onSubmit(); await f.whenStable();
    http.expectNone(url); expect(f.componentInstance.state()).toBe('error');
  });
  it('prevents duplicate submissions and renders 401 without a user event or forced detection', async () => {
    const f = start(); f.componentInstance.onSubmit(); f.componentInstance.onSubmit();
    http.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    await f.whenStable();
    expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain('Correo o contraseña incorrectos');
    expect(f.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false);
    expect(f.componentInstance.email).toBe('admin@example.test'); expect(f.componentInstance.password).toBe('unit-password');
  });
  it.each([[403, 'inactiva'], [429, 'Demasiados intentos'], [500, 'tuvo un error'], [502, 'no está disponible'], [503, 'no está disponible'], [504, 'tardó demasiado']])(
    'renders HTTP %s recoverably', async (status, message) => {
      const f = start(); f.componentInstance.onSubmit();
      http.expectOne(url).flush({}, { status, statusText: 'Error' }); await f.whenStable();
      expect(f.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
      expect(f.componentInstance.isLoading).toBe(false);
    });
  it('handles a disconnected server without clearing the form', async () => {
    const f = start(); f.componentInstance.onSubmit(); http.expectOne(url).error(new ProgressEvent('error'));
    await f.whenStable(); expect(f.componentInstance.errorMessage).toContain('No se pudo conectar');
    expect(f.componentInstance.password).toBe('unit-password'); expect(f.componentInstance.isLoading).toBe(false);
  });
  it('unlocks on timeout', async () => {
    vi.useFakeTimers(); const f = start(); f.componentInstance.onSubmit(); const request = http.expectOne(url);
    await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS); f.detectChanges();
    expect(f.componentInstance.errorMessage).toContain('tardó demasiado');
    expect(f.componentInstance.isLoading).toBe(false); expect(request.cancelled).toBe(true);
  });
  it('navigates after a valid login', async () => {
    const f = start(); f.componentInstance.onSubmit();
    http.expectOne(url).flush({ user: { id: 'unit-user', name: 'Unit', email: 'admin@example.test', role: 'Administrador' },
      accessToken: 'unit-access', refreshToken: 'unit-refresh', tokenType: 'Bearer', expiresAt: new Date(Date.now() + 3600000).toISOString() });
    await f.whenStable(); expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(f.componentInstance.state()).toBe('success');
  });
});
