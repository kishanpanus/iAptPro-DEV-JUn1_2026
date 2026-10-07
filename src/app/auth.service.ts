import {  onAuthStateChanged } from 'firebase/auth';  // Import the correct function
import { Injectable, NgZone } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { ModalService } from './services/services/model.service';
import { Admin } from './services/services/models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private timeout: any;
  public isLoggedIn = false;
  private currentUserSubject = new BehaviorSubject<any>(null);
  admin: any;
  private adminSubject = new BehaviorSubject<any>(this.getAdminDetails());  
  private otpVerifiedSubject = new BehaviorSubject<boolean>(false);
  private _otpVerified$ = new BehaviorSubject<boolean>(false);
  otpVerified$ = this._otpVerified$.asObservable();  
  private _admin$ = new BehaviorSubject<Admin | null>(null);
  admin$ = this._admin$.asObservable();


  constructor(private router: Router, private ngZone: NgZone,private auth: Auth, private modelService:ModalService) {
    onAuthStateChanged(this.auth, (user) => {
      this.currentUserSubject.next(user);  
    });
    this.isLoggedIn = !!localStorage.getItem('userId');
    this.restoreSession();
  }

  startIdleMonitor() {
    this.resetTimer();

    ['mousemove', 'keydown', 'scroll', 'click'].forEach(event =>
      window.addEventListener(event, () => this.resetTimer())
    );
  }

  resetTimer() {
    if (this.timeout) clearTimeout(this.timeout);
  
    this.timeout = setTimeout(() => {
      // Check if user is logged in (example: check for OTP verified or admin data)
      const isLoggedIn = this.isOtpVerified(); // or check: this.authService.getAdminDetails()
  
      if (isLoggedIn) {
        localStorage.clear(); // Clear all storage
        this.setOtpVerified(false);
        this.clearAdminDetails();
        this.modelService.show('Logged out due to inactivity', 'info');
        this.router.navigate(['/login']);
      }
    },  10*60 * 1000); // 10 minutes
  }
  
  

  getAdminDetails(): Admin | null {
    const raw = localStorage.getItem('loggedInAdmin');
    if (raw) {
      const session = JSON.parse(raw);
      if (Date.now() < session.expiresAt) {
        const data = session.data;
        data.name = data.name || data.adminName || '';
        return data as Admin;
      } else {
        localStorage.removeItem('loggedInAdmin');
      }
    }
    return null;
  }
  
  
  restoreSession() {
    const stored = localStorage.getItem('user');
    if (stored) {
      const parsed = JSON.parse(stored);
      this._admin$.next(parsed);
      this._otpVerified$.next(parsed.otpVerified === true);
    }
  }

  setAdminDetails(data: Admin) {
    // Normalize name field
    const fixedData = {
      ...data,
      name: data.name || (data as any)['adminName'] || ''
    };
  
    this._admin$.next(fixedData);
  
    const expiresAt = Date.now() + 1000 * 60 * 60 * 8;
    localStorage.setItem('loggedInAdmin', JSON.stringify({ data: fixedData, expiresAt }));
  
    const userWithOtp = { ...fixedData, otpVerified: true };
    localStorage.setItem('user', JSON.stringify(userWithOtp));
    console.log('Saving admin:', fixedData);

  }
  
  getCurrentAdmin(): Admin | null {
    return this._admin$.getValue();
  }
  setOtpVerified(status: boolean) {
    this._otpVerified$.next(status); 
    localStorage.setItem('otpVerified', status ? 'true' : 'false');
  }

  clearAdminDetails() {
    this._admin$.next(null); 
    localStorage.removeItem('loggedInAdmin');
  }
  


  // Optional getter
  isOtpVerified(): boolean {
    return this.otpVerifiedSubject.getValue()|| localStorage.getItem('otpVerified') === 'true';
  }

  get currentUser() {
    return this.currentUserSubject.asObservable(); // Observable to track changes
  }
}
