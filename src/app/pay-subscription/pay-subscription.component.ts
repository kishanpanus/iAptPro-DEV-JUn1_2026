// pay-subscription.component.ts
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Firestore, collection, collectionData, query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { FirestoreService } from '../services/services/firestore.service';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';

export interface Plan {
  name: string;
  description?: string;
  razorpayPlanId?: string;
  title?: string;
  features?: string[];
  price?: number; 
}

declare var Razorpay: any;
declare var Cashfree: any;

@Component({
  selector: 'app-pay-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pay-subscription.component.html',
  styleUrls: ['./pay-subscription.component.css']
})
export class PaySubscriptionComponent implements OnInit {
  @Output() paymentSuccess = new EventEmitter<any>();
  @Output() paymentFailure = new EventEmitter<any>();
  @Input() selectedPlan!: Plan;
  @Input() adminDetails!: any;
  http = inject(HttpClient);
  isUpgradeParam: boolean = false;
  plans: Plan[] = [];

  constructor(private firestoreService: FirestoreService,private route: ActivatedRoute, private router: Router,) {}

  ngOnInit() {
    const upgradeParam = this.route.snapshot.queryParamMap.get('upgrade');
    this.isUpgradeParam = upgradeParam === 'true';

    const payload = JSON.parse(localStorage.getItem('enrollmentPayload') || '{}');
    if (!this.selectedPlan && payload.selectedPlan) {
      this.selectedPlan = payload.selectedPlan;
    }
  
    // Assign and normalize adminDetails
    if (!this.adminDetails && payload.admin) {
      const admin = payload.admin;
  
      // Normalize if nested under `data` (upgrade case)
      if (admin.data) {
        this.adminDetails = {
          adminName: admin.data.name || '',
          email: admin.data.email || '',
          phoneNumber: admin.data.phone || '',
          apartmentId: admin.data.apartmentId || ''
        };
      } else {
        this.adminDetails = {
          adminName: admin.adminName || admin.name || '',
          email: admin.email || '',
          phoneNumber: admin.phoneNumber || admin.phone || '',
          apartmentId: admin.apartmentId || ''
        };
      }
    }
    // if everything is ready, start payment
    if (this.selectedPlan && this.adminDetails) {
      this.startPayment();
    }
    this.firestoreService.getActivePlans().subscribe(subscriptionPlans => {
      this.plans = subscriptionPlans.map(sp => ({
        ...sp,
        title: sp.title || this.getDefaultTitle(sp.name),
        features: sp.features || [],
        amount: sp.price ?? this.getFallbackAmount(sp.name),
      }));
      
    });
  }

  getFallbackAmount(planName: string): number {
    switch (planName) {
      case 'startup': return 499;
      case 'standard': return 999;
      case 'premium': return 1499;
      default: return 0;
    }
  }
  

  getDefaultTitle(planName: string): string {
    switch (planName) {
      case 'startup': return 'Startup Society';
      case 'trial': return '30 Days Free Trial';
      case 'standard': return 'Standard Plan';
      case 'premium': return 'Premium Plan';
      default: return planName.toUpperCase();
    }
  }
  
  startPayment() {
    const orderPayload = {
      orderId: 'APT3M-' + Date.now(),
      orderAmount: this.selectedPlan.price,
      customerName: this.adminDetails?.adminName || '',
      customerEmail: this.adminDetails?.email || '',
      customerPhone: this.adminDetails?.phoneNumber || '',
    };
  
    this.http.post('https://createcashfreeorder-n5xsrpjk7a-uc.a.run.app', orderPayload)
      .subscribe((res: any) => {
        if (res.payment_session_id) {
          const cashfree = Cashfree({ mode: 'sandbox' }); // Change to 'production' when going live
          cashfree.checkout({
            paymentSessionId: res.payment_session_id,
            returnUrl: 'http://localhost:4200/payment-status?order_id=' + orderPayload.orderId +'&upgrade=' + this.isUpgradeParam

          });
        } else {
          alert('Error generating payment session.');
        }
      }, error => {
        alert('Failed to initiate payment. Please try again.');
      });
  }
  
}
