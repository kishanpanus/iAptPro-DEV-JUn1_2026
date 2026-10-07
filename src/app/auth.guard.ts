import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    const isLoggedIn = !!localStorage.getItem('user'); // Or check auth token/session
    if (!isLoggedIn) {
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }

  // canActivate(): boolean {
  //   localStorage.setItem('phoneNumber', "9846254635");
  //   const phone = localStorage.getItem('phoneNumber');
  //   const role = localStorage.getItem('role'); 

     
  //   if (phone && (role === 'admin' || role === 'superadmin')) {
  //     return true;
  //   }
  
  //   this.router.navigate(['/login']);
  //   return false;
  // }
  

 }
