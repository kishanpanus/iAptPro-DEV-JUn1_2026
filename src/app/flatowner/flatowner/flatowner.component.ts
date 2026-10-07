import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FirestoreService } from '../../services/services/firestore.service';

@Component({
  selector: 'app-flatowner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flatowner.component.html',
  styleUrls: ['./flatowner.component.css']
})
export class FlatOwnerComponent {
  apartmentName = localStorage.getItem('apartmentName') || 'Apartment';
  phoneNumber = localStorage.getItem('phoneNumber') || '';
  flatOwnerExpenses: any[] = [];

  flatNumber = '';
  ownerName = '';
  flatOwnerApartmentId = "";
  flatOwnerId = "";

  constructor(private router: Router,private firestoreService: FirestoreService) {
   this.findFlatOwnerDataByPhone(this.phoneNumber);
    const apartmentId = this.flatOwnerApartmentId!;
  const flatOwnerId = this.flatOwnerId!;
  this.loadFlatOwnerExpenses(apartmentId, flatOwnerId);
    //this.loadOwnerInfo();
  }

  async findFlatOwnerDataByPhone(phone: string) {
    const apartmentsRef = collection(this.firestoreService.getFirestore(), 'apartments');
    const apartmentsSnapshot = await getDocs(apartmentsRef);
  
    for (const aptDoc of apartmentsSnapshot.docs) {
      const flatOwnersRef = collection(this.firestoreService.getFirestore(), `apartments/${aptDoc.id}/flatOwners`);
      const q = query(flatOwnersRef, where('phone', '==', phone));
      const flatOwnersSnapshot = await getDocs(q);
  
      if (!flatOwnersSnapshot.empty) {
        const flatOwnerDoc = flatOwnersSnapshot.docs[0];
        this.flatOwnerApartmentId = aptDoc.id;
        this.flatOwnerId = flatOwnerDoc.id;
        return;
      }
    }
  
    throw new Error('Flat owner not found');
  }
  
  // loadOwnerInfo() {
  //   // Mock data based on phone number
  //   const mockData: any = {
  //     '1234567893': { flatNumber: 'A-102', ownerName: 'Mr. Ramesh' },
  //     '1234567894': { flatNumber: 'B-305', ownerName: 'Ms. Priya' }
  //   };

  //   const info = mockData[this.phoneNumber];
  //   if (info) {
  //     this.flatNumber = info.flatNumber;
  //     this.ownerName = info.ownerName;
  //   }
  // }

  logout() {
    localStorage.removeItem('admin');
    localStorage.clear();
    this.router.navigate(['/']);
  }

  async loadFlatOwnerExpenses(apartmentId: string, flatOwnerId: string) {
    const expensesRef = collection(this.firestoreService.getFirestore(), `apartments/${apartmentId}/expenses`);
    const snapshot = await getDocs(expensesRef);
  
    this.flatOwnerExpenses = snapshot.docs
      .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
      .filter(expense => expense.flatOwners && expense.flatOwners[flatOwnerId]);
  }
  
}