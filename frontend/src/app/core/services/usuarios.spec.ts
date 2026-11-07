import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UsuariosService } from './usuarios';
import { Auth } from './auth';
import { authInterceptor } from '../interceptors/auth-interceptor';
import { environment } from '../../../environments/environment';

describe('UsuariosService', () => {
  it('uses Gateway /roles and authenticated UUID status route', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: Auth, useValue: { getToken: () => 'unit-token' } }] });
    const http = TestBed.inject(HttpTestingController), service = TestBed.inject(UsuariosService);
    service.getRoles().subscribe(); const roles = http.expectOne(`${environment.apiUrl}/roles`);
    expect(roles.request.headers.get('Authorization')).toBe('Bearer unit-token'); roles.flush([]);
    const id = '22222222-2222-4222-8222-222222222222'; service.changeStatus(id, false).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/users/${id}/status`);
    expect(req.request.method).toBe('PATCH'); expect(req.request.body).toEqual({ isActive: false });
    req.flush({}); http.verify();
  });
});
