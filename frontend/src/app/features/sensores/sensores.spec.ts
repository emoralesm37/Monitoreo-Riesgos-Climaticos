import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Sensores } from './sensores';

describe('Sensores', () => {
  let component: Sensores;
  let fixture: ComponentFixture<Sensores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sensores],
    }).compileComponents();

    fixture = TestBed.createComponent(Sensores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
