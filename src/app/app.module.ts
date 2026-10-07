import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { LoginComponent } from './auth/login/login.component';
import { DashboardComponent } from './dashboard/dashboard/dashboard.component';
import { AdminComponent } from './admin/admin/admin.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AppRoutingModule } from './app.routing.module';
import { IonicModule } from '@ionic/angular';
import { ChargesComponent } from './charges/charges/charges.component';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { environment } from './environment/environment';
import { SuperadminComponent } from './superadmin/superadmin/superadmin.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AngularFireModule } from '@angular/fire/compat'; 
import { FingerprintAIO } from '@awesome-cordova-plugins/fingerprint-aio/ngx';




@NgModule({
    declarations: [
      
    ],
    imports: [
      BrowserModule,
      AppRoutingModule,
      HttpClientModule,
      FormsModule,
      IonicModule.forRoot(),
      MatSnackBarModule,
      SuperadminComponent,     
    ],
    providers: [FingerprintAIO],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  })
  export class AppModule { }
  