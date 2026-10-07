import { Injectable } from '@angular/core';
import { Firestore, collection, doc, setDoc, getDocs, query, where } from '@angular/fire/firestore';
import { v4 as uuidv4 } from 'uuid';
import { ModalService } from './model.service';
import { Router } from '@angular/router';
import { FirestoreService } from './firestore.service';

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  constructor(
    private firestore: Firestore,
    private modalService: ModalService,
    private router: Router,
    private firestoreService: FirestoreService
  ) {}

  async finalizeEnrollment(
    newApartment: any,
    newAdmin: any,
    selectedPlan: any,
    paymentResponse: any
  ): Promise<void> {
    try {
      const now = new Date();

      const name = newApartment.name.trim();
      const city = newApartment.address.city.trim();
      const street = newApartment.address.street.trim();
      const nameLower = name.toLowerCase();
      const cityLower = city.toLowerCase();
      const streetLower = street.toLowerCase();

  

      const apartmentId = uuidv4();
      const adminId = uuidv4();
      const flatOwnerId = uuidv4();
      const trialExpiry = new Date(now);
      trialExpiry.setDate(trialExpiry.getDate() + 30);

      // Create apartment
      const apartmentRef = doc(this.firestore, `apartments/${apartmentId}`);
      await setDoc(apartmentRef, {
        name: name,
        name_lowercase: nameLower,
        city_lowercase: cityLower,
        numberOfFlats: newApartment.flatCount,
        address: {
          street: street,
          street_lowercase: streetLower,
          city: city,
          city_lowercase: cityLower,
          state: newApartment.address.state,
          pincode: newApartment.address.pincode
        },
        plan: selectedPlan?.name,
        creationDate: now.toISOString(),
        trialExpiry: selectedPlan?.name === 'trial' ? trialExpiry.toISOString() : null
      });

      // Add flatOwner
      const flatOwnerRef = doc(this.firestore, `apartments/${apartmentId}/flatOwners/${flatOwnerId}`);
      await setDoc(flatOwnerRef, {
        name: newAdmin.adminName,
        phoneNumber: newAdmin.phoneNumber,
        flat: newAdmin.flatNumber,
        block: newAdmin.block,
        role: 'admin',
        apartmentId,
        createdAt: now.toISOString()
      });

      // Add admin doc
      const adminRef = doc(this.firestore, `apartments/${apartmentId}/admins/${adminId}`);
      await setDoc(adminRef, {
        adminName: newAdmin.adminName,
        phoneNumber: newAdmin.phoneNumber,
        email: newAdmin.email || '',
        adminRole: 'admin',
        block: newAdmin.block,
        flatNumber: newAdmin.flatNumber || '',
        apartmentName: name,
        flatOwnerId,
        creationDate: now.toISOString(),
        approved: false
      });

      // Save subscription info
      const subscriptionData: any = {
        plan: selectedPlan?.name,
        amount: selectedPlan?.price,
        status: 'active',
        autoRenew: true,
        startDate: now.toISOString(),
        createdBy: newAdmin.phoneNumber
      };
      
      if (paymentResponse.payment_session_id) {
        subscriptionData.payment_session_id = paymentResponse.payment_session_id;
      }
      
      if (paymentResponse.order_id) {
        subscriptionData.order_id = paymentResponse.order_id;
      }
      
      const subscriptionRef = doc(this.firestore, `apartments/${apartmentId}/subscription/current`);
      await setDoc(subscriptionRef, subscriptionData);
      // Update user index
      await this.firestoreService.updateUserIndex(
        newAdmin.phoneNumber,
        'admin',
        'admin',
        apartmentId,
        flatOwnerId,
        name,
        newAdmin.flatNumber || undefined,
        newAdmin.adminName
      );

      this.modalService.show(
        '✅ Payment & enrollment successful! You can log in after superadmin approval.',
        'success'
      ).then(() => {
        this.router.navigate(['/']);
      });
      
    } catch (error) {
      console.error('Error during enrollment:', error);
      this.modalService.show('❌ Something went wrong during enrollment. Please contact support.', 'error');
    }
  }
}
