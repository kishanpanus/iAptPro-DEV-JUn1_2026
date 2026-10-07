import { IonicModule } from '@ionic/angular';
import { DashboardComponent } from './dashboard.component';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

@NgModule({
  imports: [
    CommonModule,
    IonicModule, 
  ],
  declarations: [DashboardComponent]
})
export class DashboardModule { }
