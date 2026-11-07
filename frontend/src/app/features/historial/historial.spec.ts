import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Historial } from './historial';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';

describe('Historial', () => {
  let component: Historial;
  let fixture: ComponentFixture<Historial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Historial],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Historial);
    component = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/alerts?status=RESUELTA`).flush([]);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('does not seed simulated history when server returns no records', () => {
    expect(component.eventos).toEqual([]);
    expect(component.error).toBe('');
    TestBed.inject(HttpTestingController).verify();
  });
});
