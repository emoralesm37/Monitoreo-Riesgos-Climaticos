import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeverityBadge } from './severity-badge';

describe('SeverityBadge', () => {
  let component: SeverityBadge;
  let fixture: ComponentFixture<SeverityBadge>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeverityBadge],
    }).compileComponents();

    fixture = TestBed.createComponent(SeverityBadge);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
