import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetPinComponent } from './set-pin.component';

describe('SetPinComponent', () => {
  let component: SetPinComponent;
  let fixture: ComponentFixture<SetPinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetPinComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SetPinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
