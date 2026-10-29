import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SensoresService } from './sensores';

describe('SensoresService', () => {
  let service: SensoresService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SensoresService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
