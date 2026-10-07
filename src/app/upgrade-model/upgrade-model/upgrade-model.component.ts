import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { collection, Firestore, getDocs, orderBy, query } from 'firebase/firestore';
import { FirestoreService } from '../../services/services/firestore.service';

@Component({
  selector: 'app-upgrade-model',
  standalone: true,
  imports: [FormsModule,CommonModule,RouterModule],
  templateUrl: './upgrade-model.component.html',
  styleUrl: './upgrade-model.component.css'
})
export class UpgradeModelComponent {
  plans: any[] = [];
  constructor(private firestoreService: FirestoreService, private router: Router) {}
  async ngOnInit() {
    this.plans = await this.firestoreService.getActiveSubscriptionPlans();
  
  }

  async selectPlan(plan: any) {
    const apartment = JSON.parse(localStorage.getItem('currentApartment') || '{}');
    const admin = JSON.parse(localStorage.getItem('loggedInAdmin') || '{}');
    var adminDetails: any
    // const adminDetails = {
    //   adminName: admin.adminName || '',
    //   email: admin.email || '',        
    //   phoneNumber: admin.phoneNumber || ''
    // };

    if (admin.data) {
      const result = await this.firestoreService.getUserByPhoneNumber(admin.data.phone);
     
       adminDetails = {
        adminName: admin.data.name || '',
        email: admin.data.email || '',
        phoneNumber: admin.data.phone || '',
        apartmentId:result?.apartmentId || ''
      };
    } 
    localStorage.setItem('enrollmentPayload', JSON.stringify({
      apartment,
      admin: adminDetails,
      selectedPlan: plan,
      upgradeFlow: true
    }));
  
    this.router.navigate(['/pay-subscription'], { queryParams: { upgrade: true } });
  
  }
}


