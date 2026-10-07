import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Reglas } from './reglas';

describe('Reglas', () => {
  let component: Reglas;
  let fixture: ComponentFixture<Reglas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Reglas],
    }).compileComponents();

    fixture = TestBed.createComponent(Reglas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
