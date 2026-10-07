import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BiometricService {
  async isSupported(): Promise<boolean> {
    return !!(window.PublicKeyCredential && typeof window.PublicKeyCredential === 'function');
  }

  async promptLogin(): Promise<boolean> {
    try {
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          timeout: 60000,
          userVerification: 'required',
        }
      });
      return !!credential;
    } catch (err) {
      console.warn('Biometric login failed', err);
      return false;
    }
  }
}
