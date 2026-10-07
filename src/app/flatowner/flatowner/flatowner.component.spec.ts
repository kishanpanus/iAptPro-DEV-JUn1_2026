import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlatownerComponent } from './flatowner.component';

describe('FlatownerComponent', () => {
  let component: FlatownerComponent;
  let fixture: ComponentFixture<FlatownerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlatownerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FlatownerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
