import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { IonDatetime, IonicModule } from '@ionic/angular';
import { ChartConfiguration } from 'chart.js';
import { FirestoreService } from '../../services/services/firestore.service';
import { addDoc, collection, CollectionReference, deleteDoc, deleteField, doc, DocumentData, getDoc, getDocs, onSnapshot, orderBy, query, QueryDocumentSnapshot, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { MarketplaceComponent } from '../../marketplace/marketplace/marketplace.component';
import { ModalService } from '../../services/services/model.service';
import { AdminCalendarComponent } from '../../admin-calendar/admin-calendar/admin-calendar.component';
import { collectionData } from '@angular/fire/firestore';
import { AuthService } from '../../auth.service';
import QRCode from 'qrcode';
import { PaymentService } from '../../services/services/payment.service';


interface FlatOwnerDetails {
  apartmentId:string;
  name: string;
  phoneNumber: string;
  block?: string;
  flat: string;
  role?: string;
  isAdmin?: boolean;
  expenseSeenAt?: any;
}
interface ApartmentDetails {
  name: string;
}
interface ExpenseItem {
  title: string;
  amount: number;
  isSplit: boolean;
  isWater?: boolean;
  originalAmount?: number;
  createdAt?: Date;
}

interface MonthlyExpenses {
  [month: string]: ExpenseItem[];
}

interface YearlyExpenses {
  [year: string]: MonthlyExpenses;
}
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IonicModule, CommonModule,FormsModule,MarketplaceComponent,AdminCalendarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  @Input() apartmentId!: string;
  @Input() ownerId!: string;

  apartmentName = localStorage.getItem('apartmentName') || 'Apartment';
  phoneNumber = localStorage.getItem('phoneNumber') || '';
  currentYear = new Date().getFullYear().toString(); 

  flatNumber = '';
  ownerName = '';
// Add these inside the FlatOwnerComponent class

maintenanceText: string = '';
feedbackText: string = '';
submittedMaintenance: any[] = [];

submittedFeedback: string[] = [];
flatOwnerExpenses: any[] = [];
flatOwnerApartmentId = "";
flatOwnerId = "";
flatOwnerDetails: FlatOwnerDetails | null = null;
apartmentDetails: ApartmentDetails | null = null;
// Track which years are open
openYears: Set<string> = new Set();
serviceProviders: any[] = [];

// Track which months are open, keyed by year

announcements: any[] = [];
paidStatusMap: Record<string, boolean> = {};
activeAnnouncement: any = null;  
spouseFormModel = {
  name: '',
  phoneNumber: '',
  accessEnabled: false
};

spouse = {
  name: '',
  phoneNumber: '',
  accessEnabled: false
};
selectedFlatOwner: any;
selectedFlatOwnerExpenses: {
  apartmentId?: string;
  flatId?: string;
  month?: string;
  items: { title: string; amount: number; isSplit?: boolean; isWater?: boolean }[];
  totalAmount: number;
} = {
  apartmentId: '',
  flatId: '',
  month: '',
  items: [],
  totalAmount: 0
};
visitor = {
  name: '',
  phone: '',
  purpose: '',
   time: ''
};

visitorQR: string = '';
groupedExpenses: YearlyExpenses = {};
  private openMonths: Set<string> = new Set<string>();
  blockModeEnabled: boolean = false;
isSpouseUser: boolean = false;
announcementReadAt: Date | null = null;
isAnnouncementOpened = false;
expenseSeenAt: Date | null = null;
providersSeenAt: Date | null = null;
marketplaceSeenAt: Date | null = null;
marketplaceItems: any[] = [];
polls: any[] = [];
pollsSeenAt: Date | null = null;
user: any;
role: string = 'spouse';
@Output() itemsLoaded = new EventEmitter<any[]>();
gatePasses: any[] = [];
newPass = {
  deliveryType: '',
  expectedTime: ''
};

ngOnInit() {
  this.user = this.authService.getAdminDetails(); // or getSessionUser()
  if (this.user?.role) {
    this.role = this.user.role;
  }
  if (!this.phoneNumber && this.user?.phone) {
    this.phoneNumber = this.user.phone;
  }
  console.log(this.apartmentId);
  console.log(this.ownerId);

  const seen = localStorage.getItem('providersSeenAt');
  this.providersSeenAt = seen ? new Date(seen) : null;
  const seenM = localStorage.getItem('marketplaceSeenAt');
  this.marketplaceSeenAt = seenM ? new Date(seenM) : null;
  const seenP = localStorage.getItem('pollsSeenAt');
  this.pollsSeenAt = seenP ? new Date(seenP) : null;
  this.resolveFlatOwnerFromUserIndex(this.phoneNumber);
}

constructor(private router: Router,private firestoreService: FirestoreService, private paymentService: PaymentService,
  private modalService: ModalService,private authService: AuthService) {
}

async resolveFlatOwnerFromUserIndex(phone: string) {
  try {
    const docRef = doc(this.firestoreService.getFirestore(), `userIndex/${phone}`);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Phone number not registered');
    }

    const indexData = docSnap.data();
    const { apartmentId, flatOwnerId, role } = indexData;

    const isFlatOwnerRole = ['owner', 'resident'].includes(role);
    const isAdminWithFlatOwner = role === 'admin' && !!flatOwnerId;

    if (!isFlatOwnerRole && !isAdminWithFlatOwner) {
      throw new Error('This user is not a flat owner');
    }

    if (!apartmentId || !flatOwnerId) {
      throw new Error('Incomplete flat owner information');
    }

    this.flatOwnerApartmentId = apartmentId;
    this.flatOwnerId = flatOwnerId;
    this.isSpouseUser = role === 'resident';

    await this.loadFlatOwnerDashboardData();
  } catch (error) {
    console.error('❌ Failed to resolve flat owner:', error);
    this.modalService.show('Invalid or unregistered phone number.', 'error');
  }
}



async findFlatOwnerDataByPhoneOLD(phone: string) {
  const firestore = this.firestoreService.getFirestore();
  const apartmentsSnapshot = await getDocs(collection(firestore, 'apartments'));

  for (const aptDoc of apartmentsSnapshot.docs) {
    const flatOwnersSnapshot = await getDocs(collection(firestore, `apartments/${aptDoc.id}/flatOwners`));

    for (const flatOwnerDoc of flatOwnersSnapshot.docs) {
      const data = flatOwnerDoc.data();
      const flatOwnerPhone = data['phoneNumber'];
      const spousePhone = data['spouse']?.['phoneNumber'];
      const spouseAccess = data['spouse']?.['accessEnabled'];

      const isMatch = flatOwnerPhone === phone || (spousePhone === phone && spouseAccess);

      if (isMatch) {
        this.flatOwnerApartmentId = aptDoc.id;
        this.flatOwnerId = flatOwnerDoc.id;
        this.isSpouseUser = spousePhone === phone && spouseAccess;

        // Load dependent Firestore data in parallel
        await this.loadFlatOwnerDashboardData();

        return;
      }
    }
  }

  throw new Error('Flat owner not found');
}

private async loadFlatOwnerDashboardData() {
  const [details, apartment, activeBanner, submittedRequests, lastSeen] = await Promise.all([
    this.getFlatOwnerDetails(this.flatOwnerApartmentId!, this.flatOwnerId!),
    this.getApartmentDetails(this.flatOwnerApartmentId!),
    this.loadActiveBanner(),
    this.loadSubmittedRequests(),
    this.loadUserLastSeen(),
    this.loadGatePasses()
  ]);

  this.flatOwnerDetails = details;
  this.apartmentDetails = apartment;
  this.expenseSeenAt = details?.expenseSeenAt?.toDate?.() || null;

  this.firestoreService.getAnnouncements(this.flatOwnerApartmentId!).subscribe(data => {
    this.announcements = data;
  });

  this.loadServiceProviders(this.flatOwnerApartmentId!);
  this.loadAnnouncements();

  const apartmentDoc = await this.firestoreService.getDocument(`apartments/${this.flatOwnerApartmentId}`);
  this.blockModeEnabled = apartmentDoc?.['blockModeEnabled'] || false;


  await this.loadFlatOwnerGroupedExpenses(this.flatOwnerApartmentId!, this.flatOwnerId!);
  await this.loadPollsForFlatOwner();
}

 /**
   * Loads and groups monthly expenses from Firestore.
   */
 async loadFlatOwnerGroupedExpenses(apartmentId: string, flatOwnerId: string) {
  const expensesRef = collection(
    this.firestoreService.getFirestore(),
    `apartments/${apartmentId}/flatOwners/${flatOwnerId}/monthlyExpenses`
  );

  try {
    const snapshot = await getDocs(expensesRef);
    const grouped: YearlyExpenses = {};

    snapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      const docId = docSnapshot.id; // e.g., "2025-06"

      if (!docId || !docId.includes('-')) {
        console.warn('Skipping document with invalid ID format:', docId, data);
        return;
      }

      const [year, month] = docId.split('-');

      // Extract regular expense items
      const regularItems: ExpenseItem[] = Array.isArray(data['items'])
        ? (data['items'] as any[]).filter((item: any) =>
            item && typeof item.title === 'string' && typeof item.amount === 'number'
          )
        : [];

      // Calculate water bill if applicable
      const usage = data['usage'] ?? 0;
      const totalAmount = data['totalAmount'] ?? 0;

      const waterBill: ExpenseItem | null = usage > 0
        ? {
            title: 'Water Bill',
            amount: totalAmount - regularItems.reduce((sum, i) => sum + i.amount, 0),
            isWater: true,
            isSplit: false
          }
        : null;

      const allItems = [...regularItems];
      if (waterBill) allItems.push(waterBill);

      if (!grouped[year]) {
        grouped[year] = {};
      }

      grouped[year][month] = allItems;
    });

    this.groupedExpenses = grouped;
    console.log('Grouped expenses loaded:', this.groupedExpenses);

    const years = this.objectKeys(this.groupedExpenses);
    if (years.length > 0) {
      const latestYear = years[0];
      this.toggleYear(latestYear);
    }

  } catch (error) {
    console.error('Error loading grouped expenses:', error);
  }
}

private async loadPollsForFlatOwner() {
  const firestore = this.firestoreService.getFirestore();
  const pollsRef = collection(firestore, `apartments/${this.flatOwnerApartmentId}/polls`);
  const snapshot = await getDocs(pollsRef);

  this.polls = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
hasVoted(poll: any): boolean {
  return poll.votes && poll.votes[this.flatOwnerId];
}

vote(poll: any, option: string) {
  const pollRef = doc(this.firestoreService.getFirestore(), `apartments/${this.flatOwnerApartmentId}/polls/${poll.id}`);
  const updatedVotes = { ...poll.votes, [this.flatOwnerId]: option };
  updateDoc(pollRef, { votes: updatedVotes });
  poll.votes = updatedVotes; // update UI instantly
}

getVotesCount(poll: any, option: string): number {
  return Object.values(poll.votes || {}).filter(v => v === option).length;
}

// async loadFlatOwnerMonthlyExpenses(apartmentId: string, flatOwnerId: string, month: string) {
//   const docRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}/flatOwners/${flatOwnerId}/monthlyExpenses/${month}`);
//   const docSnap = await getDoc(docRef);

//   if (docSnap.exists()) {
//     this.selectedFlatOwnerExpenses = docSnap.data();
//   }
// }

async loadFlatOwnerMonthlyExpenses(apartmentId: string, flatOwnerId: string, month: string) {
  const docRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}/flatOwners/${flatOwnerId}/monthlyExpenses/${month}`);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();

    const regularItems = Array.isArray(data['items']) ? data['items'] : Object.values(data['items'] || {});

    const waterExpense = (data['usage'] ?? 0) > 0
      ? {
          title: 'Water Bill',
          amount: data['totalAmount'] ?? 0,
          isWater: true,
          createdAt: data['createdDate'] ? new Date(data['createdDate']) : null
        }
      : null;

    const allItems = [...regularItems];
    if (waterExpense) allItems.push(waterExpense);

    this.selectedFlatOwnerExpenses = {
      items: allItems,
      totalAmount: data['totalAmount'] ?? 0
    };
  } else {
    this.selectedFlatOwnerExpenses = {
      items: [],
      totalAmount: 0
    };
  }
}


async deleteExpenseItem(index: number) {
  if (!this.selectedFlatOwnerExpenses) return;

  // Remove item
  this.selectedFlatOwnerExpenses.items.splice(index, 1);

  // Recalculate total
  const newTotal = this.selectedFlatOwnerExpenses.items.reduce((sum: number, item: any) => sum + item.amount, 0);
  this.selectedFlatOwnerExpenses.totalAmount = parseFloat(newTotal.toFixed(2));

  // Update Firestore
  const docRef = doc(
    this.firestoreService.getFirestore(),
    `apartments/${this.selectedFlatOwnerExpenses.apartmentId}/flatOwners/${this.selectedFlatOwnerExpenses.flatId}/monthlyExpenses/${this.selectedFlatOwnerExpenses.month}`
  );

  await updateDoc(docRef, {
    items: this.selectedFlatOwnerExpenses.items,
    totalAmount: this.selectedFlatOwnerExpenses.totalAmount
  });

  this.modalService.show('Expense item deleted and total updated.', 'success');
}

  async payNow(year: string, month: string) {
    try {
      const apartmentRef = doc(this.firestoreService.getFirestore(), 'apartments', this.flatOwnerApartmentId);
      const apartmentSnap = await getDoc(apartmentRef);

      if (!apartmentSnap.exists()) {
        console.error('Apartment data not found');
        return;
      }

      const apartmentData = apartmentSnap.data();
      const upiId = apartmentData['upiId'];
      const upiProvider = apartmentData['upiProvider'];
      const amount = this.getMonthTotal(year, month); 

      if (!upiId || !amount) {
        console.error('Missing UPI ID or amount');
        return;
      }

      const payeeName = apartmentData['name'] || 'Apartment';

      // Generate UPI URL
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR`;

      // Open UPI intent or show QR
      window.open(upiUrl, '_blank');
      //const user = this.authService.currentUser; // or however you track logged-in flat owner
     // const flatOwnerId = user?.uid || this.flatOwnerId;
  
      const monthKey = `${year}-${month}`;
      const monthDocRef = doc(
        this.firestoreService.getFirestore(),
        'flatOwners',
        this.flatOwnerApartmentId,
        'monthlyExpenses',
        monthKey
      );
  
      await setDoc(monthDocRef, {
        paid: true,
        paidAt: new Date().toISOString()
      }, { merge: true });
      
      const updatedDoc = await getDoc(monthDocRef);
      console.log('Updated monthlyExpenses doc data:', updatedDoc.data());

      console.log(`${monthKey} marked as paid for flat owner: ${ this.flatOwnerApartmentId}`);

    } catch (err) {
      console.error('Error initiating payment:', err);
    }
  }

  isMonthPaid(year: string, month: string): boolean {
    const key = `${year}-${month}`;
    return this.paidStatusMap[key] || false;
  }

// submitMaintenanceRequest() {
//   if (this.maintenanceText.trim()) {
//     this.submittedMaintenance.push(this.maintenanceText.trim());
//     this.modalService.show('Maintenance request submitted');
//     this.maintenanceText = '';
//   } else {
//     alert('Please enter your maintenance request.');
//   }
// }

// async submitMaintenanceRequest() {
//   if (!this.maintenanceText.trim()) return;

//   const request = {
//     message: this.maintenanceText,
//     flatNo: this.flatOwnerDetails?.flat,
//     name: this.flatOwnerDetails?.name,
//     timestamp: Timestamp.now()
//   };

//   const colRef: CollectionReference<DocumentData> = collection(
//     this.firestoreService.getFirestore(),
//     `apartments/${this.flatOwnerApartmentId}/maintenanceRequests`
//   );
  
//   await addDoc(colRef, request);

//   this.submittedMaintenance.unshift(request);
//   this.maintenanceText = '';
// }

async submitMaintenanceRequest() {
  if (!this.maintenanceText.trim()) return;

  const timestamp = Timestamp.now();
  const yearMonth = `${timestamp.toDate().getFullYear()}-${String(timestamp.toDate().getMonth() + 1).padStart(2, '0')}`;

  const request = {
    message: this.maintenanceText.trim(),
    status: 'pending',
    block:this.flatOwnerDetails?.block,
    flatNo: this.flatOwnerDetails?.flat,
    name: this.flatOwnerDetails?.name,
    timestamp,
    yearMonth
  };

  const firestore = this.firestoreService.getFirestore();
  const docRef = collection(firestore, `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}/maintenanceRequests`);
  await addDoc(docRef, request);

  this.submittedMaintenance.unshift(request);
  this.maintenanceText = '';
}

async loadSubmittedRequests() {
  const firestore = this.firestoreService.getFirestore();
  const queryRef = collection(firestore, `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}/maintenanceRequests`);
  const snapshot = await getDocs(queryRef);
  this.submittedMaintenance = snapshot.docs.map(doc => doc.data());
}

submitFeedback() {
  if (this.feedbackText.trim()) {
    this.submittedFeedback.push(this.feedbackText.trim());
    this.modalService.show('Feedback submitted. Thank you!','success');
    this.feedbackText = '';
  } else {
    this.modalService.show('Please enter your feedback.','info');
  }
}

  // async findFlatOwnerDataByPhone(phone: string) {
  //   const apartmentsRef = collection(this.firestoreService.getFirestore(), 'apartments');
  //   const apartmentsSnapshot = await getDocs(apartmentsRef);

  //   for (const aptDoc of apartmentsSnapshot.docs) {
  //     const flatOwnersRef = collection(this.firestoreService.getFirestore(), `apartments/${aptDoc.id}/flatOwners`);
  //     const flatOwnersSnapshot = await getDocs(flatOwnersRef);
    
  //     for (const flatOwnerDoc of flatOwnersSnapshot.docs) {
  //       const data = flatOwnerDoc.data();
  //       const flatOwnerPhone = data['phoneNumber'];
  //       const spousePhone = data['spouse']?.['phoneNumber'];
  //       const spouseAccess = data['spouse']?.['accessEnabled'];
    
  //       if (flatOwnerPhone === phone || (spousePhone === phone && spouseAccess)) {
  //         this.flatOwnerApartmentId = aptDoc.id;
  //         this.flatOwnerId = flatOwnerDoc.id;
    
  //         if (spousePhone === phone && spouseAccess) {
  //           this.isSpouseUser = true;
  //         }
        
          
  //         await this.loadFlatOwnerGroupedExpenses(this.flatOwnerApartmentId,this.flatOwnerId);
  //         this.flatOwnerDetails = await this.getFlatOwnerDetails(this.flatOwnerApartmentId, this.flatOwnerId);
  //         this.expenseSeenAt = this.flatOwnerDetails?.expenseSeenAt?.toDate?.() || null;
          
  //         console.log( this.flatOwnerDetails);
  //         this.apartmentDetails = await this.getApartmentDetails(this.flatOwnerApartmentId!);
  //         this.firestoreService.getAnnouncements(this.flatOwnerApartmentId).subscribe((data) => {
  //           this.announcements = data;
  //         });
    
  //         if (this.flatOwnerApartmentId) {
  //           this.loadServiceProviders(this.flatOwnerApartmentId);
  //         }
        
  //         await this.loadActiveBanner();
  //         await this.loadSubmittedRequests();
  //         this.firestoreService.getDocument(`apartments/${this.flatOwnerApartmentId}`).then((data: any) => {
  //           if (data) {
  //             this.blockModeEnabled = data.blockModeEnabled || false;
  //           }
  //         });
  //         await this.loadUserLastSeen();
  //         this.loadAnnouncements();
  //         return;
  //       }
  //     }
  //   }
  //   throw new Error('Flat owner not found');
  // }

  markProvidersAsSeen() {
    this.providersSeenAt = new Date();
    localStorage.setItem('providersSeenAt', this.providersSeenAt.toISOString());
  }
  
  onProvidersToggle(event: Event) {
    const el = event.target as HTMLDetailsElement;
    if (el.open) this.markProvidersAsSeen();
  }
  
  loadUserLastSeen(): Promise<void> {
    const docRef = doc(this.firestoreService.getFirestore(), `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}`);
    
    return getDoc(docRef).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        this.announcementReadAt = data['announcementReadAt']?.toDate() || null;
      }
    });
  }
  
  loadAnnouncements() {
    const ref = collection(
      this.firestoreService.getFirestore(),
      `apartments/${this.flatOwnerApartmentId}/announcements`
    );
  
    collectionData(ref, { idField: 'id' }).subscribe((data: any[]) => {
      const now = new Date();
  
      this.announcements = data
        .filter(msg => !msg.expiresAt || msg.expiresAt.toDate() > now) 
        .map(msg => ({
          ...msg,
          isUnread: !this.announcementReadAt || msg.postedAt?.toDate() > this.announcementReadAt
        }));
    });
  }
  

  onAnnouncementsToggle(event: any) {
    // if (event.target.open) {
    //   const now = new Date();
    //   this.announcementReadAt = now;
  
    //   const docRef = doc(this.firestoreService.getFirestore(), `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}`);
    //   updateDoc(docRef, { announcementReadAt: now });
    // }
  }
  get hasUnreadAnnouncements(): boolean {
    return this.announcements?.some(a => !a.rsvpSubmitted) ?? false;
  }
  
  objectKeys(obj: object): string[] {
    // Sort in descending order for years and months (e.g., 2025 before 2024, 06 before 05)
    return Object.keys(obj).sort((a, b) => b.localeCompare(a));
  }

  /**
   * Calculates the total expenses for a given year.
   */
  getYearlyTotal(year: string): number {
    let total = 0;
    const months = this.groupedExpenses[year];
    if (months) {
      for (const monthKey of Object.keys(months)) {
        total += this.getMonthlyTotal(year, monthKey);
      }
    }
    return total;
  }

/**
   * Calculates the total expenses for a given month within a year.
   */
getMonthlyTotal(year: string, month: string): number {
  let total = 0;
  const expenses = this.groupedExpenses[year]?.[month];
  if (expenses) {
    for (const exp of expenses) {
      total += exp.amount;
    }
  }
  return total;
}
/**
   * Toggles the open/closed state of a specific year.
   * When a year is opened, it also tries to open its latest month.
   */
toggleYear(year: string): void {
  if (this.openYears.has(year)) {
    this.openYears.delete(year);
  } else {
    this.openYears.add(year);
    // Optional: When a year is opened, also open its latest month for convenience
    const monthsInYear = this.objectKeys(this.groupedExpenses[year]);
    if (monthsInYear.length > 0) {
      this.toggleMonth(year, monthsInYear[0]); // Open the most recent month in this year
    }
  }
}

/**
   * Checks if a specific year is currently open (expanded).
   */
isYearOpen(year: string): boolean {
  return this.openYears.has(year);
}

/**
   * Toggles the open/closed state of a specific month within a year.
   */
toggleMonth(year: string, month: string): void {
  const key = `${year}-${month}`; // Key format: "YYYY-MM"
  if (this.openMonths.has(key)) {
    this.openMonths.delete(key);
  } else {
    this.openMonths.add(key);
  }
}

 /**
   * Checks if a specific month is currently open (expanded).
   */
 isMonthOpen(year: string, month: string): boolean {
  return this.openMonths.has(`${year}-${month}`);
}


async loadActiveBanner() {
  const now = Timestamp.fromDate(new Date());

  const snapshot = await getDocs(
    query(
      collection(this.firestoreService.getFirestore(), `apartments/${this.flatOwnerApartmentId}/announcements`),
      where('showAsBanner', '==', true),
      where('expiresAt', '>', now)
    )
  );

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    this.activeAnnouncement = doc.data();
  } else {
    this.activeAnnouncement = null;
  }
}
  
async getApartmentDetails(apartmentId: string): Promise<ApartmentDetails | null> {
  const apartmentDocRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}`);
  const apartmentSnap = await getDoc(apartmentDocRef);

  if (apartmentSnap.exists()) {
    return apartmentSnap.data() as ApartmentDetails;
  } else {
    console.error("Apartment not found");
    return null;
  }
}
  

  async getFlatOwnerDetails(apartmentId: string, flatOwnerId: string): Promise<FlatOwnerDetails | null> {
    const flatOwnerDocRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}/flatOwners/${flatOwnerId}`);
    const flatOwnerSnap = await getDoc(flatOwnerDocRef);
  
    if (flatOwnerSnap.exists()) {
      // Use type assertion here to tell TS the shape matches FlatOwnerDetails
      return flatOwnerSnap.data() as FlatOwnerDetails;
    } else {
      this.modalService.show("Flat owner not found",'error');
      return null;
    }
  }
  
  // async loadFlatOwnerExpenses(apartmentId: string, flatOwnerId: string) {
  //   const expensesRef = collection(this.firestoreService.getFirestore(), `apartments/${apartmentId}/expenses`);
  //   const snapshot = await getDocs(expensesRef);
  
  //   this.flatOwnerExpenses = snapshot.docs
  //     .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
  //     .filter(expense => expense.flatOwners && expense.flatOwners[flatOwnerId]);
  // }

  async loadFlatOwnerExpenses(apartmentId: string, flatOwnerId: string): Promise<void> {
    try {
      const firestore = this.firestoreService.getFirestore();
      const monthlyExpensesRef = collection(
        firestore,
        `apartments/${apartmentId}/flatOwners/${flatOwnerId}/monthlyExpenses`
      );
  
      const snapshot = await getDocs(monthlyExpensesRef);
  
      this.flatOwnerExpenses = snapshot.docs.map(doc => {
        const data = doc.data();
        const key = doc.id; 
        this.paidStatusMap[key] = data['paid'] === true
        return {
          id: doc.id,
          month: data['month'],
          totalAmount: data['totalAmount'],
          items: data['items'] || [],
        };
      });
  
      // Optionally sort by month (latest first)
      this.flatOwnerExpenses.sort((a, b) => b.month.localeCompare(a.month));
    } catch (error) {
      console.error('Error loading flat owner monthly expenses:', error);
      this.flatOwnerExpenses = [];
    }
  }
  
  getExpenseYears(): string[] {
    const years = new Set<string>();
    this.flatOwnerExpenses.forEach(exp => years.add(exp.month.split('-')[0]));
    return Array.from(years).sort((a, b) => +b - +a); // latest first
  }
  
  getMonthsForYear(year: string): string[] {
    return this.flatOwnerExpenses
      .filter(exp => exp.month.startsWith(year))
      .map(exp => exp.month)
      .sort((a, b) => b.localeCompare(a)); // latest month first
  }
  
  getMonthTotal(year: string, month: string): number {
    // Assuming month is like '05', '11' etc.
    const targetMonth = `${year}-${month.padStart(2, '0')}`;  // Ensure 2-digit month
    const exp = this.flatOwnerExpenses.find(e => e.month === targetMonth);
    return exp?.totalAmount || 0;
  }
  
  
  getItemsForMonth(year: string, month: string): { title: string; amount: number }[] {
    const exp = this.flatOwnerExpenses.find(e => e.month === `${year}-${month.split('-')[1]}`);
    return exp?.items || [];
  }


  getMonths(year: string): string[] {
    if (this.groupedExpenses[year]) {
      return Object.keys(this.groupedExpenses[year]);
    }
    return [];
  }
  

  getYears(): string[] {
    return Object.keys(this.groupedExpenses);
  }



  async loadServiceProviders(apartmentId: string): Promise<void> {
    try {
      const snapshot = await getDocs(
        collection(this.firestoreService.getFirestore(), `apartments/${apartmentId}/serviceProviders`)
      );
  
      this.serviceProviders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)  // You can replace `any` with a defined `ServiceProvider` interface
      }));
    } catch (error) {
      console.error('Failed to load service providers:', error);
      this.serviceProviders = []; // fallback to empty if it fails
    }
  }
  onPayNowClick(year: string, month: string): void {
    // Implement your payment logic here
    console.log(`Pay Now button clicked for ${month}-${year}`);

    // You would typically:
    // 1. Get the total amount for the month: this.getMonthlyTotal(year, month)
    // 2. Potentially get other relevant details for the payment (e.g., flatOwnerId, apartmentId)
    // 3. Call a payment service or navigate to a payment page
    // Example:
    const amountToPay = this.getMonthlyTotal(year, month);
    this.modalService.show(`Initiating payment for ₹${amountToPay.toFixed(2)} for ${month}-${year}`,'info')
    this.paymentService.initiatePayment(this.flatOwnerId, year, month, amountToPay);
  }
  
  
  // submitRSVP(announcementId: string, status: string, message: string) {
  //   const safeMessage = message ? message : ''; // or `null` if you prefer
  
  //   const data = {
  //     status,
  //     message: safeMessage,
  //     respondedAt: new Date(),
  //     flatNo: this.flatOwnerDetails?.flat || 'Unknown',
  //     name: this.flatOwnerDetails?.name || 'Unknown'
  //   };
  
  //   if (!this.flatOwnerApartmentId || !announcementId || !this.flatOwnerId) {
  //     console.error('Missing required fields for RSVP.');
  //     return;
  //   }
  
  //   this.firestoreService.saveRSVP(this.flatOwnerApartmentId, announcementId, this.flatOwnerId, data)
  //     .then(() => console.log('RSVP submitted'))
  //     .catch(err => console.error('Error submitting RSVP:', err));
  // }
  async submitRSVP(msg: any) {
    try {
      const firestore = this.firestoreService.getFirestore();
      const msgRef = doc(firestore, `apartments/${this.flatOwnerApartmentId}/announcements/${msg.id}`);
  
      await updateDoc(msgRef, {
        rsvpStatus: msg.rsvpStatus,
        rsvpMessage: msg.rsvpMessage ?? '', 
        rsvpSubmitted: true
      });
  
      // Update local copy
      msg.rsvpSubmitted = true;
  
      this.modalService.show('✅ RSVP submitted!', 'success');
    } catch (error) {
      console.error('RSVP submission failed:', error);
    }
  }
  

  async saveSpouseDetails() {
    const { name, phoneNumber } = this.spouseFormModel;
  
    const isValidPhone = /^\d{10}$/.test(phoneNumber);
    const isValidName = !!name?.trim();
  
    if (!isValidName || !isValidPhone) {
      this.modalService.show('Please enter valid name and 10-digit phone number.', 'warning');
      return;
    }
  
    this.spouse = {
      name: name.trim(),
      phoneNumber,
      accessEnabled: this.spouseFormModel.accessEnabled
    };
  
    try {
      const firestore = this.firestoreService.getFirestore();
      const flatOwnerRef = doc(firestore, `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}`);
  
      // 🔄 Update flatOwner with spouse info
      await updateDoc(flatOwnerRef, {
        spouse: {
          name: this.spouse.name,
          phoneNumber: this.spouse.phoneNumber,
          accessEnabled: !!this.spouse.accessEnabled
        }
      });
  
      // ✅ Update userIndex for spouse if access is enabled
      if (this.spouse.accessEnabled) {
        await this.firestoreService.updateUserIndex(
          this.spouse.phoneNumber,
          'resident',              // ✅ role
          'flatOwner',             // ✅ userType (flatOwner subcollection)
          this.flatOwnerApartmentId,
          this.flatOwnerId,
          undefined,               // apartmentName is optional here
          '',  
          undefined,                    // flat is optional
          this.spouse.name
        );
      }
  
      this.modalService.show('✅ Spouse access saved successfully!', 'success');
    } catch (error) {
      console.error('❌ Error updating spouse details:', error);
      this.modalService.show('❌ Failed to save spouse access.', 'error');
    }
  }
  
  
  removeSpouseAccess() {
    this.spouse = {
      name: '',
      phoneNumber: '',
      accessEnabled: false
    };
    const flatOwnerRef = doc(this.firestoreService.getFirestore(), `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}`);
    updateDoc(flatOwnerRef, {
      spouse: deleteField()
    }).then(() => {
      this.modalService.show('Spouse access removed!', 'success');
      this.spouse = {
        name: '',
        phoneNumber: '',
        accessEnabled: false
      };
      
    }).catch(err => {
      console.error('Error removing spouse access', err);
    });
  }
  
  // get hasUnseenExpenses(): boolean {
  //   if (!this.expenseSeenAt) return false;
  
  //   return Object.values(this.groupedExpenses as Record<string, any>).some((monthlyGroup: any) =>
  //     Object.values(monthlyGroup as Record<string, any[]>).some((expenseArray: any[]) =>
  //       expenseArray.some(exp => {
  //         const created = exp.createdAt?.toDate?.();
  //         return created && created > this.expenseSeenAt!;
  //       })
  //     )
  //   );
  // }
  
  get hasUnseenExpenses(): boolean {
    if (!this.expenseSeenAt) return false;
  
    return Object.values(this.groupedExpenses ?? {}).some((monthlyGroup: any) =>
      (Object.values(monthlyGroup) as any[][]).some((expenseArray) =>
        expenseArray.some(exp => {
          const created = exp.createdAt?.toDate?.();
          return created && created > this.expenseSeenAt!;
        })
      )
    );
  }
  
  get hasNewServiceProviders(): boolean {
    if (!this.providersSeenAt) {
      return false;
    }
  
    return this.serviceProviders.some(sp => {
      const created = sp.createdAt?.toDate?.();
      return created && created > this.providersSeenAt!;
    });
  }
  
  get hasNewPolls(): boolean {
    if (!this.pollsSeenAt) return false;
  
    return this.polls.some(poll => {
      const created = poll.createdAt?.toDate?.();
      return created && created > this.pollsSeenAt!;
    });
  }
  
  onPollsToggle(event: Event) {
    const details = event.target as HTMLDetailsElement;
    if (details.open) {
      this.pollsSeenAt = new Date();
      localStorage.setItem('pollsSeenAt', this.pollsSeenAt.toISOString());
    }
  }
  

  onExpensesToggle(event: any) {
    if (event.target.open) {
      const now = new Date();
      this.expenseSeenAt = now;
  
      const docRef = doc(this.firestoreService.getFirestore(), `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}`);
      updateDoc(docRef, { expenseSeenAt: now });
    }
  }
  
  get hasNewMarketplaceItems(): boolean {
    if (!this.marketplaceSeenAt) return false;
  
    return this.marketplaceItems.some(item => {
      const created = item.createdAt?.toDate?.(); // Firestore timestamp
      return created && created > this.marketplaceSeenAt!;
    });
  }
  
  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  markAsDelivered(passId: string) {
    const firestore = this.firestoreService.getFirestore();
    const docRef = doc(
      firestore,
      `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}/gatePasses/${passId}`
    );
    updateDoc(docRef, { status: 'delivered' });
  }
  
  
  addGatePass() {
    const firestore = this.firestoreService.getFirestore();
    const passRef = collection(firestore, `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}/gatePasses`);
    addDoc(passRef, {
      deliveryType: this.newPass.deliveryType,
      expectedTime: Timestamp.fromDate(new Date(this.newPass.expectedTime)),
      status: 'pending',
      createdAt: Timestamp.now()
    });
    
  }
  

  loadGatePasses() {
    const firestore = this.firestoreService.getFirestore();
    const passRef = collection(firestore, `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}/gatePasses`);
    const q = query(passRef, orderBy('expectedTime', 'desc'));
    onSnapshot(q, snapshot => {
      this.gatePasses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    });
  }
  async deleteGatePass(passId: string) {
    const confirmed = await this.modalService.show('Are you sure you want to delete this delivery entry?', 'confirm');
  
    if (confirmed) {
      const firestore = this.firestoreService.getFirestore();
      const docRef = doc(firestore, `apartments/${this.flatOwnerApartmentId}/flatOwners/${this.flatOwnerId}/gatePasses/${passId}`);
      await deleteDoc(docRef);
    }
  }

  generateVisitorQR(visitor: any) {
    const { name, phone, purpose, time } = visitor;
  
    if (!name || !phone || !purpose || !time) {
      alert('Please fill all fields');
      return;
    }
  
    const payload = JSON.stringify({
      name,
      phone,
      purpose,
      time,
      createdAt: new Date().toISOString(),
      used: false
    });
  
    QRCode.toDataURL(payload)
      .then((url: string) => {
        this.visitorQR = url;
      })
      .catch((err: any) => {
        console.error('QR Code generation failed:', err);
        alert('QR generation failed');
      });
  }
  

  resetVisitorQR() {
    this.visitor = {
      name: '',
      phone: '',
      purpose: '',
      time: ''
    };
    this.visitorQR = "";
  }
  copyQrImage(img: HTMLImageElement) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
  
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
  
    ctx.drawImage(img, 0, 0);
  
    canvas.toBlob(blob => {
      if (!blob) return;
  
      const item = new ClipboardItem({ 'image/png': blob });
      navigator.clipboard.write([item]).then(() => {
        this.modalService.show('QR image copied to clipboard!', 'success');
      }).catch(err => {
        console.error('Failed to copy QR image:', err);
        this.modalService.show('Failed to copy QR image.', 'error');
      });
    });
  }
  
  logout() {
    localStorage.clear();
    this.router.navigate(['/']);
  }
}