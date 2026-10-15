
import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';

import { AppComponent } from './app/app.component';
import { AppModule } from './app/app.module';
import { environment } from './app/environment/environment';

// AngularFire
import {
  provideFirebaseApp
} from '@angular/fire/app';

import {
  provideAuth
} from '@angular/fire/auth';

import {
  provideFirestore
} from '@angular/fire/firestore';

// Firebase SDK
import {
  initializeApp
} from 'firebase/app';

import {
  getAuth
} from 'firebase/auth';

import {
  getFirestore,
  initializeFirestore
} from 'firebase/firestore';

// Capacitor
import { Capacitor } from '@capacitor/core';

// --------------------------------------------------
// 1. Initialize Firebase once for all platforms
// --------------------------------------------------

const app = initializeApp(environment.firebaseConfig);

const auth = getAuth(app);

// Preserve existing imports from other files
export { auth };

// --------------------------------------------------
// 2. Initialize Firestore based on platform
// --------------------------------------------------

const platform = Capacitor.getPlatform();

console.log('[APP] Running platform:', platform);

const firestore =
  platform === 'ios'
    ? initializeFirestore(app, {
        experimentalForceLongPolling: true
      })
    : getFirestore(app);

console.log(
  '[FIRESTORE] Initialized for platform:',
  platform
);

// --------------------------------------------------
// 3. Bootstrap Angular application
// --------------------------------------------------

bootstrapApplication(AppComponent, {
  providers: [

    // Firebase application
    provideFirebaseApp(() => app),

    // Firebase Authentication
    provideAuth(() => auth),

    // Firestore - shared initialized instance
    provideFirestore(() => firestore),

    // Existing application module providers
    importProvidersFrom(AppModule)

  ]
})
.then(() => {
  console.log('[APP] Bootstrap successful');
})
.catch((error) => {
  console.error('[APP] Bootstrap failed:', error);
});
