import { TestBed } from '@angular/core/testing';
import { AuthSimuladoService } from './auth-simulado';

describe('AuthSimuladoService', () => {
  let service: AuthSimuladoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthSimuladoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
