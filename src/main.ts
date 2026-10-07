import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { appConfig } from './app/app.config';
import { environment } from './app/environment/environment';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { AppModule } from './app/app.module';
import { importProvidersFrom } from '@angular/core';

const app = initializeApp(environment.firebaseConfig);
const auth = getAuth(app);

export { auth };

bootstrapApplication(AppComponent, {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
    provideAuth(() => getAuth()), // ✅ this is correct here
    provideFirestore(() => getFirestore()), // ✅ correct here
    importProvidersFrom(AppModule), // 
  ]
});


