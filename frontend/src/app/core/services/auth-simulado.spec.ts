import { TestBed } from '@angular/core/testing';
import { AuthSimulado } from './auth-simulado';

describe('AuthSimulado', () => {
  let service: AuthSimulado;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthSimulado);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
