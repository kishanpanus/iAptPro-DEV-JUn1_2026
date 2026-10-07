import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EnrollmentService } from '../services/services/EnrollmentService';
import { ModalService } from '../services/services/model.service';
import { FirestoreService } from '../services/services/firestore.service';


@Component({
  selector: 'app-payment-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-status.component.html',
  styleUrls: ['./payment-status.component.css']
})
export class PaymentStatusComponent implements OnInit {
  status: 'loading' | 'success' | 'failed' = 'loading';
  orderId: string | null = null;
  isUpgrade: boolean = false;
  message : string | null = null;

  constructor(private route: ActivatedRoute, private router: Router, private http: HttpClient,private firestoreService: FirestoreService, private enrollmentService: EnrollmentService,private modalService: ModalService) {}

  ngOnInit(): void {

    const isUpgradeParam = this.route.snapshot.queryParamMap.get('upgrade');
    this.isUpgrade = isUpgradeParam === 'true';

    // if (this.isUpgrade) {
    //   this.message = '✅ Your plan upgrade was successful! You now have access to new features.';
    // }
    this.orderId = this.route.snapshot.queryParamMap.get('order_id');

    if (this.orderId) {
      const functionURL = `https://verifycashfreepayment-n5xsrpjk7a-uc.a.run.app?order_id=${this.orderId}`;

      this.http.get<any>(functionURL).subscribe(
        (res) => {

          const savedData = JSON.parse(localStorage.getItem('enrollmentPayload') || '{}');
          if (res.order_status === 'PAID' && savedData?.admin) {
            this.enrollmentService.finalizeEnrollment(
              savedData.apartment,
              savedData.admin,
              savedData.selectedPlan,
              res // Cashfree response
            );
          
            localStorage.removeItem('enrollmentPayload');
            if (this.isUpgrade) {
              this.status = 'success';
              this.modalService.show(
                '✅ Your subscription has been successfully upgraded! You now have access to new features.',
                'success'
              );

              const apartmentId = savedData.admin?.apartmentId;
              const planName = savedData.selectedPlan?.name;
              if (apartmentId && planName) {
                this.firestoreService.updateApartmentPlan(apartmentId, planName)
                .then(() => {
                  const updatedApartment = {
                    ...savedData.apartment,
                    plan: planName,
                    trialExpiry: null
                  };
                  localStorage.setItem('currentApartment', JSON.stringify(updatedApartment));
                })
                .catch((error) => {
                  console.error('Failed to update apartment plan:', error);
                });
              }
              // Redirect to role-based dashboard
              setTimeout(() => {
                const role = savedData.admin?.role || 'admin';
                const routeMap: any = {
                  admin: '/admin',
                  owner: '/owner',
                  resident: '/resident',
                  security: '/security'
                };
                const redirectPath = routeMap[role] || '/';
                this.router.navigate([redirectPath]);
              }, 3000);
            } else {
              this.router.navigate(['/enrollment-success']);
            }
          } else {
            this.status = 'failed';
          }
        },
        () => {
          this.status = 'failed';
        }
      );
    } else {
      this.status = 'failed';
    }
  }
}
