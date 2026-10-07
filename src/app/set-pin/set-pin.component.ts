import { Component } from '@angular/core';
import { FirestoreService } from '../services/services/firestore.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExtendedRole } from '../services/services/models/models';
import { ModalService } from '../services/services/model.service';
import { FingerprintAIO } from '@awesome-cordova-plugins/fingerprint-aio/ngx';
import { Platform } from '@angular/cdk/platform';
import { Capacitor } from '@capacitor/core';

type UserType = 'superadmin' | 'admins' | 'flatOwners' | 'securityUsers';

function getUserCollectionByRole(role: string): UserType {
  switch (role.toLowerCase()) {
    case 'admin': return 'admins';
    case 'owner':
    case 'resident': return 'flatOwners';
    case 'security': return 'securityUsers';
    case 'superadmin': return 'superadmin'; 
    default: throw new Error('Unknown role: ' + role);
  }
}

@Component({
  selector: 'app-set-pin',
  standalone: true,
  imports: [CommonModule, FormsModule,RouterModule],
  providers: [FingerprintAIO],
  templateUrl: './set-pin.component.html',
  styleUrl: './set-pin.component.css'
})

export class SetPinComponent {
  pin = '';
  confirmPin = '';

  constructor(
    private router: Router,
    private firestoreService: FirestoreService,
    private modalService: ModalService, private faio: FingerprintAIO, private platform: Platform 
  ) {}

  async savePin() {
    if (this.pin !== this.confirmPin) {
      this.modalService.show('PINs do not match', 'warning');
      return;
    }

    if (!/^\d{4}$/.test(this.pin)) {
      this.modalService.show('PIN must be a 4-digit number', 'info');
      return;
    }

    const apartmentId = localStorage.getItem('apartmentId');
    const userId = localStorage.getItem('userId');
    const deviceId = localStorage.getItem('apt3m_deviceId') || 'default';
    const userRole = localStorage.getItem('userRole') || '';

    // 🔐 Use role mapping directly (skip isUserType check)
    let userCollection: UserType;
    try {
      userCollection = getUserCollectionByRole(userRole.toLowerCase());
    } catch (err) {
      this.modalService.show('Unknown user role', 'error');
      this.router.navigate(['/login']);
      return;
    }

    if ((userCollection !== 'superadmin' && !apartmentId) || !userId) {
      this.modalService.show('Missing user context. Please login again.', 'error');
      this.router.navigate(['/login']);
      return;
    }

    // 🔐 Save PIN in Firestore
    await this.firestoreService.setPinForDevice( userCollection === 'superadmin' ? '' : apartmentId!, userCollection, userId, deviceId, this.pin);

    localStorage.setItem('pinSet', 'true');

    // ✅ Redirect based on role
    switch (userRole.toLowerCase() as ExtendedRole) {
      case 'admin':
        this.router.navigate(['/admin']);
        break;
      case 'superadmin':
        this.router.navigate(['/superadmin']);
        break;
      case 'security':
        this.router.navigate(['/security']);
        break;
      case 'owner':
      case 'resident':
        this.router.navigate(['/dashboard']);
        break;
      default:
        this.router.navigate(['/login']);
        break;
    }
  }

  async enableFaceID() {
    const apartmentId = localStorage.getItem('apartmentId');
    const userId = localStorage.getItem('userId');
    const deviceId = localStorage.getItem('apt3m_deviceId') || 'default';
    const userRole = localStorage.getItem('userRole') || '';
  
    if (!apartmentId || !userId) {
      this.modalService.show('Missing user context. Please login again.', 'error');
      this.router.navigate(['/login']);
      return;
    }
  
    let userCollection: UserType;
    try {
      userCollection = getUserCollectionByRole(userRole);
    } catch {
      this.modalService.show('Unknown role for biometric login.', 'error');
      return;
    }
  
    if (!this.platform.ANDROID && !this.platform.IOS) {
      this.modalService.show('Biometric login is only supported on mobile.', 'info');
      return;
    }
  
    if (!Capacitor.isNativePlatform()) {
      this.modalService.show('Biometric login is only available on mobile apps.', 'info');
      return;
    }

    try {
      const result = await this.faio.show({
        title: 'Apt3M Login',
        subtitle: 'Secure Login',
        description: 'Authenticate using biometrics',
        fallbackButtonTitle: 'Use PIN'
      });
  
      await this.firestoreService.setPinForDevice(
        apartmentId,
        userCollection,
        userId,
        deviceId,
        '', // not setting PIN here
        true // enable Face ID
      );
    
  
        localStorage.setItem('faceIdEnabled', 'true');
        localStorage.setItem('pinSet', 'true');
  
        this.modalService.show('Face ID enabled successfully!', 'success');
  
        const routeMap: Record<ExtendedRole, string> = {
          admin: '/admin',
          superadmin: '/superadmin',
          security: '/security',
          owner: '/dashboard',
          resident: '/dashboard'
        };
  
        const route = routeMap[userRole.toLowerCase() as ExtendedRole] || '/login';
        this.router.navigate([route]);
    
    } catch (err) {
      console.warn('Biometric auth failed:', err);
      this.modalService.show('Biometric auth failed or was cancelled.', 'warning');
    }
  }
}
  
