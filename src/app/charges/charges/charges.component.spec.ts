import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChargesComponent } from './charges.component';

describe('ChargesComponent', () => {
  let component: ChargesComponent;
  let fixture: ComponentFixture<ChargesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChargesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChargesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
