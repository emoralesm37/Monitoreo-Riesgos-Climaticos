import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReportesService } from './reportes';
import { authInterceptor } from '../interceptors/auth-interceptor';
import { Auth } from './auth';
import { environment } from '../../../environments/environment';

describe('ReportesService', () => {
  let http: HttpTestingController;
  let service: ReportesService;
  const url = `${environment.apiUrl}/reports`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), { provide: Auth, useValue: { getToken: () => 'unit-test-token' } }] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ReportesService);
  });
  afterEach(() => http.verify());

  it('generates communities through Gateway without inventing request fields', () => {
    const result = { status: 'completed' as const, report_id: 'mongo-id', file_name: 'communities.pdf', message: 'OK' };
    service.generateCommunities().subscribe(data => expect(data).toEqual(result));
    const req = http.expectOne(`${url}/communities`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    req.flush(result);
  });
  it('requests the real limited history contract', () => {
    service.history().subscribe(data => expect(data).toEqual({ total: 0, reports: [] }));
    const req = http.expectOne(`${url}/history?limit=50`);
    expect(req.request.method).toBe('GET');
    req.flush({ total: 0, reports: [] });
  });
  it('downloads a Blob using the existing JWT interceptor', () => {
    const pdf = new Blob(['%PDF-test'], { type: 'application/pdf' });
    service.download('mongo-id').subscribe(data => expect(data).toBe(pdf));
    const req = http.expectOne(`${url}/mongo-id/download`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.headers.get('Authorization')).toBe('Bearer unit-test-token');
    req.flush(pdf);
  });
});
