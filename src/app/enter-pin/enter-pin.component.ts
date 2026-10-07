import { Component } from '@angular/core';
import { FirestoreService } from '../services/services/firestore.service';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-enter-pin',
  standalone: true,
  imports: [CommonModule, FormsModule,RouterModule],
  templateUrl: './enter-pin.component.html',
  styleUrl: './enter-pin.component.css'
})
export class EnterPinComponent {
  pin: string = '';
  error: string = '';

  constructor(
    private firestoreService: FirestoreService,
    private router: Router
  ) {}

  async verifyPin() {
    const apartmentId = localStorage.getItem('apartmentId');
    const userType = localStorage.getItem('userType'); // 'admins' | 'flatOwners' | 'securityUsers'
    const userId = localStorage.getItem('userId');
    const deviceId = localStorage.getItem('apt3m_deviceId') || 'default';
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (!apartmentId || !userType || !userId || !user || !deviceId) {
      this.error = 'Session expired. Please login again.';
      this.router.navigate(['/login']);
      return;
    }

    // ✅ Call service to verify PIN
    const isValid = await this.firestoreService.verifyPinForDevice(apartmentId, userType as any, userId, deviceId, this.pin);

    if (isValid) {
      switch (user.role?.toLowerCase()) {
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
          this.router.navigate(['/dashboard']);
          break;
      }
    } else {
      this.error = 'Incorrect PIN';
    }
  }
}