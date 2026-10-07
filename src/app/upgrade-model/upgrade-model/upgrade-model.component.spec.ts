import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpgradeModelComponent } from './upgrade-model.component';

describe('UpgradeModelComponent', () => {
  let component: UpgradeModelComponent;
  let fixture: ComponentFixture<UpgradeModelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpgradeModelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpgradeModelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
