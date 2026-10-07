import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FirestoreService } from '../../services/services/firestore.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { ModalService } from '../../services/services/model.service';
import { PaySubscriptionComponent } from '../../pay-subscription/pay-subscription.component';
import { Plan } from '../../services/services/models/models';

interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
}

interface NewApartment {
  name: string;
  flatCount: number;
  address: Address;
}

interface NewAdmin {
  adminName: string;
  phoneNumber: string;
  email?: string;
}

interface NewResident {
  apartmentIdentifier: string; // Could be apartment code or name
  name: string;
  flatNumber: string;
  phoneNumber: string;
  email?: string;
}


declare var Razorpay: any;

@Component({
  selector: 'app-enrollment',
  imports: [CommonModule, FormsModule,RouterModule,PaySubscriptionComponent  ],
  templateUrl: './enrollment.component.html',
  styleUrl: './enrollment.component.css'
})
export class EnrollmentComponent implements OnInit {
  enrollmentType: 'apartment_admin' | 'resident' = 'apartment_admin'; // Default to apartment admin
  
  indianStates: string[] = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
  ];
  
selectedPlan!: Plan;
  
  isCheckingEnrollment: boolean = false;

  apartmentName = '';
  numberOfFlats: number = 0;
  city = '';
  state = '';
  pincode = '';

  adminName = '';
  phoneNumber = '';
  flatNumber = ''; 
  statusMessage = '';
  newApartment = {
    name: '',
    flatCount: null,
    address: {
      street: '',
      city: '',
      state: '',
      pincode: ''
    }
  };

  newAdmin = {
    adminName: '',
    phoneNumber: '',
    email: '',
    block: '',
    flatNumber: '',
    sqft: 0
  };

  newResident = {
    apartmentIdentifier: '',
    name: '',
    block: '',
    flatNumber: '',
    phoneNumber: '',
    email: ''
  };


agreeTerms = false;

  isLoading: boolean = false;
  errorMessage: string = '';
  plans: Plan[] = [];
  
  // Firebase Auth variables for phone verification (if you use it for new sign-ups)
  windowRef: any;
  verificationCode: string | undefined;
  user: any; // Firebase User
  showTermsModal = false;
  termsAccepted: boolean = false; 
  @Input() showBackToLogin: boolean = true;
  @Output() closePopup = new EventEmitter<void>();
  @Input() visible: boolean = true;
  @Output() visibleChange = new EventEmitter<boolean>();
  apartmentId: string | null = null;
  showPayment: boolean = false;

  constructor(
    private router: Router,
    private firestoreService: FirestoreService, private modalService: ModalService
  ) { }

  async ngOnInit(): Promise<void> {
    document.body.classList.add('enrollment-page');
    await this.fetchPlans();
  }

  ngOnDestroy() {
    document.body.classList.remove('enrollment-page');
  }

  fetchPlans() {
    this.firestoreService.getActivePlans().subscribe(plans => {
      this.plans = plans;
  
      if (this.plans.length > 0) {
      this.selectedPlan = this.plans.find(p => p.name === 'trial') || this.plans[0];
      }
    });
  }
  

  cancelEnrollment(): void {
    this.router.navigate(['/login']); // Navigate back to the login page
  }

  // async submitEnrollment() {
  //   if (this.enrollmentType === 'apartment_admin') {
  //     await this.enrollApartmentWithAdmin();
  //   } else {
  //     await this.registerResident();
  //   }
  // }

  async submitEnrollment() {
    if (!this.newAdmin.adminName?.trim() || !this.newAdmin.phoneNumber?.trim()) {
      this.modalService.show('⚠️ Please fill in all required fields.', 'warning');
      return;
    }
  
    if (this.enrollmentType === 'apartment_admin') {
      await this.enrollApartmentWithAdmin();
    } else {
      await this.registerResident();
    }
  }
  
  onPlanSelect(plan: Plan) {
    this.selectedPlan = plan;
  }

  async enrollApartmentWithAdmin() {
    const firestore = this.firestoreService.getFirestore();
  
    const name = this.newApartment.name.trim();
    const city = this.newApartment.address.city.trim();
    const street = this.newApartment.address.street.trim();
  
    const nameLower = name.toLowerCase();
    const cityLower = city.toLowerCase();
    const streetLower = street.toLowerCase();
  
    // 1️⃣ Check for duplicates
    const existing = await getDocs(
      query(
        collection(firestore, 'apartments'),
        where('name_lowercase', '==', nameLower),
        where('city_lowercase', '==', cityLower),
        where('address.street_lowercase', '==', streetLower)
      )
    );
  
    if (!existing.empty) {
      this.modalService.show(
        `Apartment "${name}" already exists at ${street}, ${city}. Please use a different name or address.`,
        'error'
      );
      return;
    }
  
    const apartmentId = uuidv4();
    const adminId = uuidv4();
    const flatOwnerId = uuidv4();
    const now = new Date();
    const trialExpiry = new Date(now);
    trialExpiry.setDate(trialExpiry.getDate() + 30);
  
    this.apartmentId = apartmentId;

    // 2️⃣ Create apartment document
    const apartmentRef = doc(firestore, `apartments/${apartmentId}`);
    await setDoc(apartmentRef, {
      name: name,
      name_lowercase: nameLower,
      city_lowercase: cityLower,
      numberOfFlats: this.newApartment.flatCount,
      address: {
        street: street,
        street_lowercase: streetLower,
        city: city,
        city_lowercase: cityLower,
        state: this.newApartment.address.state,
        pincode: this.newApartment.address.pincode
      },
      plan: this.selectedPlan,
      creationDate: now.toISOString(),
      trialExpiry: this.selectedPlan?.name === 'trial' ? trialExpiry.toISOString() : null

    });
  
    // 3️⃣ Create flatOwner document
    const flatOwnerRef = doc(firestore, `apartments/${apartmentId}/flatOwners/${flatOwnerId}`);
    await setDoc(flatOwnerRef, {
      name: this.newAdmin.adminName,
      phoneNumber: this.newAdmin.phoneNumber,
      flat: this.newAdmin.flatNumber,
      block: this.newAdmin.block,
      role: 'admin',
      apartmentId: apartmentId,
      createdAt: now.toISOString()
    });
  
    // 4️⃣ Create admin document
    const adminRef = doc(firestore, `apartments/${apartmentId}/admins/${adminId}`);
    await setDoc(adminRef, {
      adminName: this.newAdmin.adminName,
      phoneNumber: this.newAdmin.phoneNumber,
      email: this.newAdmin.email || '',
      adminRole: 'admin',
      block: this.newAdmin.block,
      flatNumber: this.newAdmin.flatNumber || '',
      apartmentName: name,
      flatOwnerId: flatOwnerId,
      creationDate: now.toISOString(),
      approved: false
    });
  
    // 5️⃣ Update userIndex
    await this.firestoreService.updateUserIndex(
      this.newAdmin.phoneNumber,
      'admin',
      'admin',
      apartmentId,
      flatOwnerId,
      name,
      this.newAdmin.flatNumber || undefined,
      this.newAdmin.sqft,
      this.newAdmin.adminName
    );
  
    this.modalService.show('✅ Apartment and admin enrolled successfully!', 'success');
    this.router.navigate(['/login']);
  }
  
  onCloseClick(event: Event) {
    console.log('[Child] Close clicked');
    this.visibleChange.emit(false);
  }
  
  goBackToLanding(): void {
    this.router.navigate(['/']); 
  }
  

  async registerResident() {
    // Try to find the apartment by name (you could enhance this with apartment code later)
    const apartmentsRef = collection(this.firestoreService.getFirestore(), 'apartments');
    const querySnapshot = await getDocs(query(apartmentsRef, where('name', '==', this.newResident.apartmentIdentifier)));

    if (querySnapshot.empty) {
      this.modalService.show(
        'Apartment not found. Please check the name or code.',
        'error'
      );
      return;
    }
    

    const apartmentDoc = querySnapshot.docs[0];
    const apartmentId = apartmentDoc.id;
    const residentId = uuidv4();

    const residentRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}/flatOwners/${residentId}`);
    await setDoc(residentRef, {
      name: this.newResident.name,
      phoneNumber: this.newResident.phoneNumber,
      email: this.newResident.email || '',
      block: this.newAdmin.block,
      flat: this.newResident.flatNumber,
      approved: false,
      createdAt: new Date().toISOString()
    });

    this.modalService.show('✅ Registration submitted! Waiting for admin approval.');
  }

  private generateApartmentCode(name: string): string {
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 8);
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${sanitizedName}-${randomSuffix}`;
  }

  private calculateSubscriptionEndDate(plan: 'standard' | 'premium'): Date | null {
    const now = new Date();
    if (plan === 'standard' || plan === 'premium') {
      // For simplicity, let's assume monthly plans. You'd integrate payment gateway for actual periods.
      return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }
    return null;
  }
  openTermsModal(event: Event) {
    event.preventDefault();
    this.showTermsModal = true;
  }
  
  closeTermsModal() {
    this.showTermsModal = false;
  }
  goBackToLogin() {
    this.router.navigate(['/login']);
  }

  async handleEnrollment(): Promise<void> {
    if (this.isCheckingEnrollment) return; // prevent multiple clicks
  
    this.isCheckingEnrollment = true;
  
    if (!this.newAdmin.adminName?.trim() || !this.newAdmin.phoneNumber?.trim()) {
      this.modalService.show('⚠️ Please enter admin name and phone number.', 'warning');
      this.isCheckingEnrollment = false;
      return;
    }
  
    if (!this.termsAccepted) {
      this.modalService.show('⚠️ Please accept the terms before continuing.', 'warning');
      this.isCheckingEnrollment = false;
      return;
    }
  
    if (!this.selectedPlan) {
      this.modalService.show('⚠️ Please select a subscription plan.', 'warning');
      this.isCheckingEnrollment = false;
      return;
    }
  
    const name = this.newApartment.name.trim();
    const city = this.newApartment.address.city.trim();
    const street = this.newApartment.address.street.trim();
  
    const nameLower = name.toLowerCase();
    const cityLower = city.toLowerCase();
    const streetLower = street.toLowerCase();
  
    const existing = await getDocs(
      query(
        collection(this.firestoreService.getFirestore(), 'apartments'),
        where('name_lowercase', '==', nameLower),
        where('city_lowercase', '==', cityLower),
        where('address.street_lowercase', '==', streetLower)
      )
    );
  
    if (!existing.empty) {
      this.modalService.show(
        `⚠️ Apartment "${name}" already exists at ${street}, ${city}. Please use a different name or address.`,
        'error'
      );
      this.isCheckingEnrollment = false;
      return;
    }
  
    // Save to localStorage
    localStorage.setItem('adminToSave', JSON.stringify(this.newAdmin));
    localStorage.setItem('enrollmentPayload', JSON.stringify({
      apartment: this.newApartment,
      admin: this.newAdmin,
      selectedPlan: this.selectedPlan
    }));
  
    if (this.selectedPlan.name === 'trial') {
      console.log('Free Trial Selected. Enrolling without payment...');
      this.enrollApartmentWithAdmin();
    } else {
      console.log('Paid plan selected. Proceeding to payment...');
      this.showPayment = true;
  
      setTimeout(() => {
        const el = document.getElementById('paymentSection');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  
    this.isCheckingEnrollment = false;
  }
  
  
  
  
  async onPaymentSuccess(response: any) {
    const firestore = this.firestoreService.getFirestore();
    const now = new Date();
  
    const name = this.newApartment.name.trim();
    const city = this.newApartment.address.city.trim();
    const street = this.newApartment.address.street.trim();
    const nameLower = name.toLowerCase();
    const cityLower = city.toLowerCase();
    const streetLower = street.toLowerCase();
  
    // Check for duplicates
    const existing = await getDocs(
      query(
        collection(firestore, 'apartments'),
        where('name_lowercase', '==', nameLower),
        where('city_lowercase', '==', cityLower),
        where('address.street_lowercase', '==', streetLower)
      )
    );
  
    if (!existing.empty) {
      this.modalService.show(
        `Apartment "${name}" already exists at ${street}, ${city}. Please use a different name or address.`,
        'error'
      );
      return;
    }
  
    const apartmentId = uuidv4();
    this.apartmentId = apartmentId;
    const adminId = uuidv4();
    const flatOwnerId = uuidv4();
    const trialExpiry = new Date(now);
    trialExpiry.setDate(trialExpiry.getDate() + 30);
  
    // Create apartment
    const apartmentRef = doc(firestore, `apartments/${apartmentId}`);
    await setDoc(apartmentRef, {
      name: name,
      name_lowercase: nameLower,
      city_lowercase: cityLower,
      numberOfFlats: this.newApartment.flatCount,
      address: {
        street: street,
        street_lowercase: streetLower,
        city: city,
        city_lowercase: cityLower,
        state: this.newApartment.address.state,
        pincode: this.newApartment.address.pincode
      },
      plan: this.selectedPlan?.name,
      creationDate: now.toISOString(),
      trialExpiry: this.selectedPlan?.name === 'trial' ? trialExpiry.toISOString() : null
    });
  
    // Add flatOwner
    const flatOwnerRef = doc(firestore, `apartments/${apartmentId}/flatOwners/${flatOwnerId}`);
    await setDoc(flatOwnerRef, {
      name: this.newAdmin.adminName,
      phoneNumber: this.newAdmin.phoneNumber,
      flat: this.newAdmin.flatNumber,
      block: this.newAdmin.block,
      role: 'admin',
      apartmentId,
      createdAt: now.toISOString()
    });
  
    // Add admin doc
    const adminRef = doc(firestore, `apartments/${apartmentId}/admins/${adminId}`);
    await setDoc(adminRef, {
      adminName: this.newAdmin.adminName,
      phoneNumber: this.newAdmin.phoneNumber,
      email: this.newAdmin.email || '',
      adminRole: 'admin',
      block: this.newAdmin.block,
      flatNumber: this.newAdmin.flatNumber || '',
      apartmentName: name,
      flatOwnerId,
      creationDate: now.toISOString(),
      approved: false
    });
  
    // Save subscription info
    const subscriptionRef = doc(firestore, `apartments/${apartmentId}/subscription/current`);
    await setDoc(subscriptionRef, {
      plan: this.selectedPlan?.name,
      amount: this.selectedPlan?.price,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_subscription_id: response.razorpay_subscription_id,
      status: 'active',
      autoRenew: true,
      startDate: now.toISOString(),
      createdBy: this.newAdmin.phoneNumber
    });
  
    // Update user index
    await this.firestoreService.updateUserIndex(
      this.newAdmin.phoneNumber,
      'admin',
      'admin',
      apartmentId,
      flatOwnerId,
      name,
      this.newAdmin.flatNumber || undefined,
      this.newAdmin.sqft,
      this.newAdmin.adminName
    );
  
    this.modalService.show('✅ Payment & enrollment successful!', 'success');
    this.router.navigate(['/login']);
  }
  onPaymentFailure(error: any) {
    this.modalService.show('❌ Payment failed. Enrollment was not completed.', 'error');
  }
  

  // async onPaymentSuccess(response: any) {
  //   const firestore = this.firestoreService.getFirestore();
  //   const now = new Date();
  
  //   const subscriptionRef = doc(firestore, `apartments/${this.apartmentId}/subscription/current`);
  //   await setDoc(subscriptionRef, {
  //     plan: this.selectedPlan.name,
  //     amount: this.selectedPlan.price,
  //     razorpay_payment_id: response.razorpay_payment_id,
  //     razorpay_subscription_id: response.razorpay_subscription_id,
  //     status: 'active',
  //     autoRenew: true,
  //     startDate: now.toISOString(),
  //     createdBy: this.newAdmin.phoneNumber
  //   });
    
  
  //   this.modalService.show('✅ Payment successful! Subscription activated.', 'success');
  //   this.router.navigate(['/login']);
  // }
  
}
