import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, HostListener, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminQuery } from '../../models/admin-query.model';
import { FirestoreService } from '../../services/services/firestore.service';
import { firstValueFrom, from, of, Subscription, switchMap } from 'rxjs';
import { AuthService } from '../../auth.service';
import { Auth, authState } from '@angular/fire/auth';
import { DashboardComponent } from '../../dashboard/dashboard/dashboard.component';
import { ActivatedRoute, Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { MarketplaceComponent } from '../../marketplace/marketplace/marketplace.component';
import { ModalService } from '../../services/services/model.service';
import { v4 as uuidv4 } from 'uuid';
import { UpgradeModelComponent } from '../../upgrade-model/upgrade-model/upgrade-model.component';
import { AdminCalendarComponent } from '../../admin-calendar/admin-calendar/admin-calendar.component';
import {
  collection,
  deleteDoc,
  doc,
  docData,
  Firestore,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  addDoc,
  arrayUnion,
  increment,
  collectionGroup,
  deleteField,
  limit,
  orderBy,
  Timestamp,
  onSnapshot
} from '@angular/fire/firestore'; // ✅


interface ExpenseItem {
  title: string;
  amount: number;
  isSplit: boolean;
  originalAmount?: number;
}

interface MonthlyExpenses {
  [month: string]: ExpenseItem[];
}

interface YearlyExpenses {
  [year: string]: MonthlyExpenses;
}

interface WaterBillSettings {
  waterTariffPerLiter: number;
  waterUsageThreshold: number;
  extraWaterCharge: number;
  effectiveFromMonth: string; 
  savedAt?: string;
}

interface MonthlyOwnerExpense {
  ownerId: string;
  ownerName: string;
  flat: string;
  totalAmount: number;
  items: { title: string; amount: number }[];
}

interface ApartmentDetails {
  name: string;
  address: {
    city: string;
    state: string;
    street: string;
    pincode: string;
  };
  numberOfFlats: number;
  plan: string;
  trialExpiry?: string;
}

interface Poll {
  id: string;
  title: string;
  description: string;
  options: string[]; // e.g., ["Blue", "Green", "Yellow"]
  createdBy: string;
  createdAt: Timestamp;
  isActive: boolean;
  votes?: Record<string, string>; // flatOwnerId -> selected option
}


@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule,DashboardComponent,MarketplaceComponent, AdminCalendarComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
})
export class AdminComponent implements OnInit {
  groupedExpenses: {
    [year: string]: {
      [month: string]: MonthlyOwnerExpense[]
    }
  } = {};
  activeTab: 'admin' | 'flatowner' = 'admin';

  // Expenses
  newExpense: string = '';
  expenseAmount: number | null = null;
 // expenses: Expense[] = [];

  // Announcements
  announcementMessage: string = '';
  announcements: any[] = [];
  oldPhoneNumber: string = '';
  // Flat Owners
  newOwnerName: string = '';
  newOwnerPhone: string = '';
  //latOwners: { name: string; phone: string }[] = [];
  maintenanceIssue = '';
  feedback = '';
  newOwnerIsAdmin = false;
  adminQuery: string = '';
  submittedQueries: string[] = [];
  adminQueryMessage = '';
  adminQueries: AdminQuery[] = [];
  apartmentName: string = '';
  phoneNumber: string = '';
  newOwnerFlat = '';
  newOwnerSqft: string = '';
  isEditing = false;
  editingIndex: number | null = null;
  editingOwnerId: string | null = null;
  newOwnerRole = '';
  adminApartmentId: string | null = null; // To store the admin's apartment ID
  authSubscription: Subscription | null = null;
  flatOwners: any[] = [];
  loggedInAdminPhoneNumber: string | null = null; // To store the logged-in admin's phone number
  adminData: (string | null)[] = [];
  selectedOwnerId: string | null = null;
  editingOwner: any = null; 
  deletingOwner: any = null; 
  showEditModal = false;
  editingOwnerIndex: number | null = null;
  newExpenseName: string = '';
  editIndex: number | null = null;
  editTitle: string = '';
  editAmount: number | null = null;
  // groupedExpenses: { [year: string]: { [month: string]: Expense[] } } = {};
  currentYear = new Date().getFullYear();
  editingExpenseId: string | null = null;
  expenses: any[] = [];
  currentMonth = new Date().toLocaleString('default', { month: 'long' });
  showAddOwner = false;
  expandedExpenseIndex: number | null = null;
  selectedFlatId : any = null; 
  expandedExpenses: { [key: string]: number | null } = {};
  editOwnerId: string | null = null;
  editItemIndex: number | null = null;
  editItemTitle: string = '';
  editItemAmount: number = 0;
  adminFlatOwnerId: string | null = null;
  isWaterSectionOpen = false;
  previousReading: number = 0;
  currentReading: number = 0;
  waterTariffPerLiter: number = 0;
  totalUsage: number | null = null;
  totalAmount: number | null = null;
  isCalculating = false;
  calculationError = '';
  apartmentId = '';
  adminId = '';
  isSuperAdminViewing = false;
  upiId: string = '';
  upiProvider: string = 'PhonePe'; 
  paymentId: string | null = null; 
  excelFlatOwners: any[] = [];
  invalidRows: any[] = [];
  waterUsageThreshold: number = 10000;
  extraWaterCharge: number = 100;
  thresholdExceeded: boolean = false;
  exceededLiters: number = 0;
  /* waterbill */
  selectedMonth: string = '';
  statusMessage: string = '';
  waterBillFlats: any[] = [];
  saveStatusMessage = '';
  showScrollTop = false;
  monthsInView: string[] = [];
  waterBillData: { [month: string]: any[] } = {};
  availableFlats: any[] = [];
  trialDaysLeft: number | null = null;
  trialExpired = false;
  pendingExpenses: {
    title: string;
    amount: number;
    flatId: string | null;
    isSplit?: boolean;
    originalAmount?: number;
  }[] = [];
  sortedPendingExpenses: any[] = [];
sortKey: string = 'title';
sortAsc: boolean = true;
  splitEqually: boolean = false;
  adminName: string = '';
  provider  = {
    name: '',
    category: '',
    phone: '',
    description: '',
    verified: true
  };
serviceProviders: any[] = [];
editingProviderId: string | null = null;
showAsBanner: boolean = true;
expiresAt: string = '';
apartmentDetails: ApartmentDetails = {
  name: '',
  address: {
    city: '',
    state: '',
    street: '',
    pincode: ''
  },
  numberOfFlats: 0,
  plan: '',
  trialExpiry: ''
};
showUpgrade = false;
maintenanceRequests: any[] = [];
filteredRequests: any[] = [];
selectedYear = '';
allRequests: any[] = [];       // All fetched maintenance requests
selectedStatus: string = 'all'
currentYear1 = new Date().getFullYear();
currentMonth1 = new Date().getMonth() + 1; // Jan = 0
availableYears: number[] = [];
settingsApplyMonth: string = ''; 
editingMonth: string | null = null;
editedValues: any = {};
blockModeEnabled: boolean = false; 
newOwnerBlock: string = ''; 
selectedBlockFilter: string = '';
blockList: string[] = [];
copyFromMonth: string = '';
waterBillingSettings: any = {};
waterBillingEntries: [string, any][] = [];
newPoll = {
  title: '',
  description: '',
  options: [''],
};

polls: any[] = [];
requestsSeenAt: Date | null = null; 
announcementsSeenAt: Date | null = null;
pollsSeenAt: Date | null = null;
marketplaceSeenAt: Date | null = null;
marketplaceItems: any[] = [];
@Output() itemsLoaded = new EventEmitter<any[]>();
loadedItems: any[] = [];
user: any;
role: string = 'spouse';
newSecurity = {
  name: '',
  phone: '',
  email: ''
};
securityUsers: any[] = [];

constructor(private firestoreService: FirestoreService,  private router: Router,private firestore: Firestore,private authService: AuthService, private auth: Auth, private route: ActivatedRoute,private modalService: ModalService,
  private cdr: ChangeDetectorRef) {}
  
  // async ngOnInit() {
  //   const routeParams = this.route.snapshot.paramMap;
  //   const routeApartmentId = routeParams.get('apartmentId');
  //   const routeAdminId = routeParams.get('adminId');
    
  //   if (this.trialExpired) {
  //     this.showUpgrade = true;
  //   }

  //   if (routeApartmentId && routeAdminId) {
  //     // SuperAdmin is viewing Admin panel
  //     this.isSuperAdminViewing = true;
  //     this.adminApartmentId = routeApartmentId;
  //     this.adminFlatOwnerId = routeAdminId;

  //     this.loadFlatOwners();
  //     this.loadMonthlyExpenses();
  //     this.loadAnnouncements();
  //     this.loadAdminQueries();
  //     this.loadWaterBillingSettings();
  //     await this.loadAllSavedWaterBillingData();
    
  //   } else{
  //     this.apartmentName = localStorage.getItem('apartmentName') || '';
  //     this.phoneNumber = localStorage.getItem('phoneNumber') || '';
  //     const { apartmentId, apartmentName, adminFlatOwnerId,adminName  } = await this.firestoreService.getApartmentDetailsByAdminPhoneNumber(this.phoneNumber);
  //     this.adminFlatOwnerId = adminFlatOwnerId;
  //     this.adminApartmentId  = apartmentId;
  //     this.adminName = adminName!;
  //     console.log(this.phoneNumber);
  //     const firestore = this.firestoreService.getFirestore();

  //     const apartmentRef = doc(firestore, `apartments/${this.adminApartmentId}`);
  //     const snapshot = await getDoc(apartmentRef);
    
  //     if (snapshot.exists()) {
  //       const apartmentData = snapshot.data();
  //       this.loadTrialInfo(apartmentData); 
  //     }
    
  //       //this.checkAdminByPhone(firestore, this.phoneNumber );
  //   // this.getLoggedInAdminPhoneNumberAndApartmentId();
  //   await this.loadAvailableFlats();
  //     this.loadAdminQueries(); // if not already called
  //     this.loadFlatOwners();
  //   // this.loadExpenses();
  //   this.loadMonthlyExpenses();
  //   this.loadAnnouncements();
  //   this.getUpi();
  //   this.loadAvailableFlats().then(() => this.loadExistingBillingMonths());
  //   this.sortedPendingExpenses = [...this.pendingExpenses];
  //   this.loadServiceProviders(this.adminApartmentId!);
  //   this.loadApartmentDetails();
  //   this.loadAllMaintenanceRequests();
  //   this.generateYearOptions();
  //   this.loadWaterBillingSettings();
  //   this.getAdminName();
  //   await this.loadAllSavedWaterBillingData();

  //   }

  // }
 
  async ngOnInit() {
    const routeParams = this.route.snapshot.paramMap;
    const routeApartmentId = routeParams.get('apartmentId');
    const routeAdminId = routeParams.get('adminId');
    const seen = localStorage.getItem('requestsSeenAt');
    this.requestsSeenAt = seen ? new Date(seen) : null;
    const seenA = localStorage.getItem('announcementsSeenAt');
    this.announcementsSeenAt = seenA ? new Date(seenA) : null;
    const seenP = localStorage.getItem('pollsSeenAt');
    this.pollsSeenAt = seenP? new Date(seenP) : null;
    const seenM = localStorage.getItem('marketplaceSeenAt');
    this.marketplaceSeenAt = seenM ? new Date(seenM) : null;
    this.user = this.authService.getAdminDetails(); // or getSessionUser()

    console.log(this.user);
    if (this.user?.role) {
      this.role = this.user.role;
    }
    if (this.trialExpired) {
      this.showUpgrade = true;
    }
  
    if (routeApartmentId && routeAdminId) {
      // SuperAdmin is viewing Admin panel
      this.isSuperAdminViewing = true;
      this.adminApartmentId = routeApartmentId;
      this.adminFlatOwnerId = routeAdminId;
  
      await this.loadAllAdminDashboardData();
    } else {
      // Admin logged in normally
      this.phoneNumber = localStorage.getItem('phoneNumber') || '';
      this.apartmentName = localStorage.getItem('apartmentName') || '';

      if (!this.adminFlatOwnerId && this.user?.flatOwnerId) {
        this.adminFlatOwnerId = this.user.flatOwnerId;
      }
      
      if (!this.adminApartmentId && this.user?.apartmentId) {
        this.adminApartmentId = this.user.apartmentId;
      }
      
      if (!this.adminName && this.user?.name) {
        this.adminName = this.user.name;
      }
      
      if (!this.apartmentName && this.user?.apartmentName) {
        this.apartmentName = this.user.apartmentName;
      }
      if (!this.phoneNumber && this.user?.phone) {
        this.phoneNumber = this.user.phone;
      }
      const { apartmentId, apartmentName, adminFlatOwnerId, adminName } =
        await this.firestoreService.getApartmentDetailsByAdminPhoneNumber(this.phoneNumber);
  
      this.adminApartmentId = apartmentId;
      this.adminFlatOwnerId = adminFlatOwnerId;
      this.adminName = adminName!;
      this.apartmentName = apartmentName!;
  
      await this.loadApartmentBasics();
      await this.loadAllAdminDashboardData();
    }
   

  }
  

  private async loadApartmentBasics() {
    const firestore = this.firestoreService.getFirestore();
    const apartmentRef = doc(firestore, `apartments/${this.adminApartmentId}`);
    const snapshot = await getDoc(apartmentRef);
  
    if (snapshot.exists()) {
      const apartmentData = snapshot.data();
      this.loadTrialInfo(apartmentData);
      this.getUpi();
      this.loadWaterBillingSettings();
    }
  }
  
  private async loadAllAdminDashboardData() {
    await Promise.all([
      this.loadSubcollections(),
      this.loadAvailableFlats(),
      this.loadApartmentDetails(),
      this.loadAllMaintenanceRequests(),
      this.loadAllSavedWaterBillingData(),
      this.loadServiceProviders(this.adminApartmentId!),
      this.loadMarketplaceItems(),
      this.loadSecurityUsers()
    ]);
  
    await this.loadMonthlyExpenses(),

    this.sortedPendingExpenses = [...this.pendingExpenses];
    this.generateYearOptions();
    this.getAdminName();
  }
  
  private async loadSubcollections() {
    const firestore = this.firestoreService.getFirestore();
    const apartmentId = this.adminApartmentId!;
  
    const flatOwnersRef = collection(firestore, `apartments/${apartmentId}/flatOwners`);
    const expensesRef = collection(firestore, `apartments/${apartmentId}/monthlyExpenses`);
    const announcementsRef = collection(firestore, `apartments/${apartmentId}/announcements`);
    const queriesRef = collection(firestore, `apartments/${apartmentId}/adminQueries`);
    const serviceProvidersRef = collection(firestore, `apartments/${apartmentId}/serviceProviders`);
    const pollsRef = collection(firestore, `apartments/${apartmentId}/polls`);
  
    const [
      flatOwnersSnap,
      expensesSnap,
      announcementsSnap,
      queriesSnap,
      serviceProvidersSnap,
      pollsSnap
    ] = await Promise.all([
      getDocs(flatOwnersRef),
      getDocs(expensesRef),
      getDocs(announcementsRef),
      getDocs(queriesRef),
      getDocs(serviceProvidersRef),
      getDocs(pollsRef)
    ]);
  
    this.flatOwners = flatOwnersSnap.docs.map(doc => doc.data());
    this.expenses = expensesSnap.docs.map(doc => doc.data());
    this.announcements = announcementsSnap.docs.map(doc => doc.data());
    this.adminQueries = queriesSnap.docs.map(doc => {
      const data = doc.data();
    
      return {
        apartment: data['apartment'],
        adminPhone: data['adminPhone'],
        message: data['message'],
        status: data['status'],
        timestamp: data['timestamp'],
      } as AdminQuery;
    });
    
    
    this.serviceProviders = serviceProvidersSnap.docs.map(doc => doc.data());
    this.polls = pollsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
  

  generateYearOptions() {
    const currentYear = new Date().getFullYear();
    this.availableYears = Array.from({ length: 11 }, (_, i) => currentYear + i);
  }
  // handleUpgradePayment() {
  //   this.showUpgrade = false;
  //   alert('Redirecting to payment...');
  //   // Trigger payment gateway or mark premium
  // }

  async getAdminName(){
    const firestore = this.firestoreService.getFirestore();
    const adminDocRef = doc(firestore, `apartments/${this.adminApartmentId}/flatOwners/${this.adminFlatOwnerId}`);
    const adminSnap = await getDoc(adminDocRef);

    let adminName = 'Unknown';
    if (adminSnap.exists()) {
      adminName = adminSnap.data()['name'] || 'Unknown';
    }
  }
  async loadAllMaintenanceRequests() {
    const firestore = this.firestoreService.getFirestore();
    const queryRef = collectionGroup(firestore, 'maintenanceRequests');
    const snapshot = await getDocs(queryRef);
  
    this.allRequests = snapshot.docs.map(doc => {
      const data = doc.data();
      const pathParts = doc.ref.path.split('/');
      return {
        id: doc.id,
        ...data,
        apartmentId: pathParts[1],
        flatOwnerId: pathParts[3]
      };
    });

    // Set default filters (current year/month & pending)
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  
    this.selectedYear = this.selectedYear || currentYear;
    this.selectedMonth = this.selectedMonth || currentMonth;
    this.selectedStatus = this.selectedStatus || 'pending';
  
    // Apply filters to show default view
    this.applyFilters();
  }
  
  applyFilters() {
    this.filteredRequests = this.allRequests.filter(r => {
      const requestDate = r.timestamp?.toDate?.() || new Date(); // Fallback
  
      const yearMatches = !this.selectedYear || requestDate.getFullYear().toString() === this.selectedYear;
      const monthMatches = !this.selectedMonth || String(requestDate.getMonth() + 1).padStart(2, '0') === this.selectedMonth;
      const statusMatches = this.selectedStatus === 'all' || (r.status || '').toLowerCase() === this.selectedStatus;
  
      return yearMatches && monthMatches && statusMatches;
    });
  }
  

  filterRequestsByMonth() {
    if (this.selectedYear && this.selectedMonth) {
      const ym = `${this.selectedYear}-${this.selectedMonth}`;
      this.filteredRequests = this.maintenanceRequests.filter(req => req.yearMonth === ym);
    } else {
      this.filteredRequests = [...this.maintenanceRequests];
    }
  }

  applyStatusFilter() {
    this.loadAllMaintenanceRequests();
    if (this.selectedStatus === 'all') {
      this.filteredRequests = [...this.allRequests];
    } else {
     this.filteredRequests = this.allRequests.filter(r => 
        (r.status || '').toLowerCase() === this.selectedStatus
      );
    }
  }
  exportToCSV() {
    const rows = this.filteredRequests.map(r => ({
      Name: r.name,
      Flat: r.flatNo,
      Message: r.message,
      Status: r.status,
      Date: r.timestamp.toDate().toLocaleDateString()
    }));
  
    const csvContent = [
      Object.keys(rows[0]).join(','), // headers
      ...rows.map(obj => Object.values(obj).join(','))
    ].join('\n');
  
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'maintenance_requests.csv';
    link.click();
  }

  async updateRequestStatus(request: any, newStatus: string) {
    console.log(request);
    const firestore = this.firestoreService.getFirestore();
    const requestRef = doc(firestore, `apartments/${request.apartmentId}/flatOwners/${request.flatOwnerId}/maintenanceRequests/${request.id}`);
    
    await updateDoc(requestRef, { status: newStatus });
  
    request.status = newStatus; // Update UI instantly
    this.modalService.show(`Status updated to ${newStatus}`, 'success');
  }


  handleUpgradePayment() {
    const options: any = {
      key: 'rzp_test_XXXXXXX', // Your Razorpay public key
      amount: 99900,
      currency: 'INR',
      name: 'Apt3M Upgrade',
      description: 'Upgrade to premium',
      handler: (response: any) => {
        this.modalService.show('✅ Payment successful! ID: ' + response.razorpay_payment_id);
      },
      prefill: {
        name: this.apartmentName,
        contact: this.phoneNumber
      }
    };
  
    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  }
  


  loadTrialInfo(apartmentData: any) {
    if (apartmentData.plan === 'trial') {
      const today = new Date();
      const expiry = new Date(apartmentData.trialExpiry);
      const diff = Math.max(0, Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
      this.trialDaysLeft = diff;
      this.trialExpired = diff === 0;
    } else {
      this.trialDaysLeft = null;
      this.trialExpired = false;
    }
  }

  async loadApartmentDetails() {
    const docRef = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}`);
    const docSnap = await getDoc(docRef);
  
    if (docSnap.exists()) {
      this.apartmentDetails = docSnap.data() as ApartmentDetails;
    }
  }
  
  
  

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.showScrollTop = window.scrollY > 300;
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  async loadAvailableFlats() {
    const flatsRef = collection(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/flatOwners`);
    const snapshot = await getDocs(flatsRef);
    this.availableFlats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async loadExistingBillingMonths() {
    const sampleFlatId = this.availableFlats[0]?.id;
    if (!sampleFlatId) return;
    const expensesRef = collection(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/flatOwners/${sampleFlatId}/monthlyExpenses`);
    const snapshot = await getDocs(expensesRef);
    const months = snapshot.docs.map(doc => doc.id);
    this.monthsInView = [...new Set(months)].sort().reverse();
  }

  getPreviousMonth(month: string): string {
    const [year, m] = month.split('-').map(Number);
    const date = new Date(year, m - 1);
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

    async initializeNewBillingCycle() {
    if (!this.selectedMonth) {
      this.modalService.show('Please select a billing month first.', 'error');
      return;
    }
  
    const monthFormatRegex = /^\d{4}-\d{2}$/;
    if (!monthFormatRegex.test(this.selectedMonth)) {
      this.modalService.show('Invalid billing month format.', 'error');
      return;
    }
  
    const monthKey = this.selectedMonth;
    const currentMonth = monthKey;
    const lastMonth = this.getPreviousMonth(monthKey);
  
    let tariff = 0, threshold = 0, extraCharge = 0;
  
    try {
      const settingsRef = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/settings/waterBilling`);
      const settingsSnap = await getDoc(settingsRef);
  
      if (!settingsSnap.exists()) {
        this.modalService.show('⚠️ Please configure global Water Billing Settings before starting a billing cycle.', 'warning');
        return;
      }
  
      const settings = settingsSnap.data();
      const setting = settings[monthKey];
  
      if (!setting || setting.waterTariffPerLiter == null || setting.waterUsageThreshold == null || setting.extraWaterCharge == null) {
        this.modalService.show(`⚠️ Settings missing for ${monthKey}. Please configure them in Global Settings.`, 'warning');
        this.scrollToGlobalSettings?.();
        return;
      }
  
      tariff = setting.waterTariffPerLiter;
      threshold = setting.waterUsageThreshold;
      extraCharge = setting.extraWaterCharge;
    } catch (err) {
      console.error('Error fetching billing settings:', err);
      this.modalService.show('❌ Failed to retrieve billing settings.', 'error');
      return;
    }
  
    if (this.availableFlats.length === 0) {
      this.modalService.show('No flats available to initialize billing cycle.', 'error');
      return;
    }
  
    let flatsWithWaterBill = 0;
    const flatsMissingWater = [];
  
    for (const flat of this.availableFlats) {
      const ref = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/flatOwners/${flat.id}/monthlyExpenses/${currentMonth}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        if ('currentReading' in data && data['currentReading'] !== null && data['currentReading'] !== undefined) {
          flatsWithWaterBill++;
        } else {
          flatsMissingWater.push(flat);
        }
      } else {
        flatsMissingWater.push(flat);
      }
    }
  
    if (flatsWithWaterBill === this.availableFlats.length) {
      this.statusMessage = `✅ Billing cycle for ${monthKey} already exists for all flats.`;
      this.modalService.show(this.statusMessage, 'success');
      return;
    }
  
    const monthData: any[] = [];
  
    for (const flat of flatsMissingWater) {
      const lastRef = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/flatOwners/${flat.id}/monthlyExpenses/${lastMonth}`);
      const newRef = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/flatOwners/${flat.id}/monthlyExpenses/${currentMonth}`);
  
      let prevReading: number | null = null;
      let isFirstCycle = false;
  
      try {
        const lastSnap = await getDoc(lastRef);
        isFirstCycle = !lastSnap.exists();
        prevReading = isFirstCycle ? null : lastSnap.data()?.['currentReading'] || 0;
      } catch (error) {
        console.warn(`No previous reading for ${flat.id}`, error);
        isFirstCycle = true;
      }
  
      const billRow = {
        flatId: flat.id,
        flatNo: flat.flat || flat.name || flat.id,
        previousReading: prevReading,
        currentReading: null,
        usage: 0,
        exceeded: 0,
        pricePerLiter: tariff,
        extraWaterCharge: extraCharge,
        waterUsageThreshold: threshold,
        totalAmount: 0,
        isFirstCycle,
        status: isFirstCycle ? 'First Cycle' : 'Pending',
        isPaid: false,
        month: currentMonth,
        createdDate: new Date().toISOString()
      };
  
      try {
        await setDoc(newRef, billRow, { merge: true });
        monthData.push(billRow);
      } catch (error) {
        console.error(`Error writing bill for ${flat.id}`, error);
      }
    }
  
    this.waterBillData[currentMonth] = monthData;
    if (!this.monthsInView.includes(currentMonth)) {
      this.monthsInView.unshift(currentMonth);
    }
  
    // Update visible months list
    // this.visibleWaterBillMonths = this.monthsInView.filter(month =>
    //   this.waterBillData[month]?.some(f => f?.flatId && f?.previousReading !== null)
    // );
    this.statusMessage = `✅ Billing cycle initialized for ${currentMonth}.`;
    this.modalService.show(this.statusMessage, 'success');
  }
  
  
  // Filter months to only show cycles that actually have water meter readings
  // get visibleWaterBillMonths(): string[] {
  //   return Object.keys(this.waterBillData).filter(month => {
  //     const flats = this.waterBillData[month];
  //     return Array.isArray(flats) && flats.length > 0;
  //   });
  // }
  

    scrollToGlobalSettings() {
      const el = document.getElementById('global-settings');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }

    async calculateForFlat(flat: any, month: string) {
      if (flat.currentReading != null && flat.previousReading != null) {
        const settings = await this.getWaterBillSettingsForMonth(month);
    
        if (!settings) {
          console.error(`Could not retrieve settings for ${month}`);
          flat.totalAmount = 0;
          flat.status = 'Error';
          return;
        }
    
        const usage = flat.currentReading - flat.previousReading;
        const usageWithinThreshold = Math.min(usage, flat.waterUsageThreshold);
        const usageAboveThreshold = Math.max(0, usage - flat.waterUsageThreshold);
        
        let total = 0;
        if (flat.extraWaterCharge === 0) {
          total = usage * flat.pricePerLiter;
        } else {
          total = (usageWithinThreshold * flat.pricePerLiter) +
                  (usageAboveThreshold * flat.extraWaterCharge);
        }
        
        flat.usage = usage;
        flat.exceeded = usageAboveThreshold;
        flat.totalAmount = total;
        flat.status = 'Calculated';
      }
    }
    
    

  // calculateForFlat(flat: any, month: string) {
  //   if (flat.currentReading != null && flat.previousReading != null) {
  //     const usage = flat.currentReading - flat.previousReading;
  //     let total = 0;
  
    
  //     const usageWithinThreshold = Math.min(usage, this.waterUsageThreshold);
  //     const usageAboveThreshold = Math.max(0, usage - this.waterUsageThreshold);
  
  //     if (this.extraWaterCharge === 0) {
       
  //       total = usageAboveThreshold * this.waterTariffPerLiter;
  //     } else {
      
  //       total = (usageWithinThreshold * this.waterTariffPerLiter) +
  //               (usageAboveThreshold * this.extraWaterCharge);
  //     }
  
  //     flat.usage = usage;
  //     flat.exceeded = usageAboveThreshold; 
  //     flat.totalAmount = total;
  //     flat.status = 'Calculated';
    
  //   }
  // }
  

  // calculateForFlat(flat: any, month: string) {
  //   if (flat.currentReading != null && flat.previousReading != null) {
  //     const usage = flat.currentReading - flat.previousReading;
  //     const exceeded = usage > this.waterUsageThreshold ? usage - this.waterUsageThreshold : 0;
  //     const total = usage * this.waterTariffPerLiter + (exceeded > 0 ? this.extraWaterCharge : 0);

  //     flat.usage = usage;
  //     flat.exceeded = exceeded;
  //     flat.totalAmount = total;
  //     flat.status = 'Calculated';
  //   }
  // }

  async saveMonthData(month: string) {
    const batch = this.waterBillData[month];
    for (const flat of batch) {
      const ref = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/flatOwners/${flat.flatId}/monthlyExpenses/${month}`);
      await setDoc(ref, flat, { merge: true });
    }
    this.statusMessage = `✅ Saved water bills for ${month}`;
  }

  async deleteBillingCycle(month: string) {
    const confirmed = await this.modalService.show(
      `Are you sure you want to delete water meter readings for ${month}?`,
      'confirm'
    );
  
    if (!confirmed) {
      this.statusMessage = 'Deletion cancelled.';
      return;
    }
  
    try {
      for (const flat of this.availableFlats) {
        const ref = doc(
          this.firestoreService.getFirestore(),
          `apartments/${this.adminApartmentId}/flatOwners/${flat.id}/monthlyExpenses/${month}`
        );
  
        await updateDoc(ref, {
          currentReading: deleteField(),
          previousReading: deleteField(),
          usage: deleteField(),
          exceeded: deleteField(),
          pricePerLiter: deleteField(),
          extraWaterCharge: deleteField(),
          waterUsageThreshold: deleteField(),
          totalAmount: deleteField(),
          isFirstCycle: deleteField(),
          status: deleteField(),
          isPaid: deleteField(),
          createdDate: deleteField()
        });
  
        console.log(`✅ Water billing fields cleared for flat ${flat.id} for month ${month}`);
      }
  
      // Clear from local cache if needed
      delete this.waterBillData[month];
      this.monthsInView = this.monthsInView.filter(m => m !== month);
  
      this.statusMessage = `🗑️ Water meter readings deleted for ${month}.`;
  
    } catch (error) {
      console.error(`❌ Error deleting billing fields for month ${month}:`, error);
      this.statusMessage = `❌ Failed to delete billing fields for ${month}. See console for details.`;
    }
  }
  isUnsubmittedMonth(month: string): boolean {
    const flats = this.waterBillData[month] || [];
    if (!flats.length) return false;
  
    return flats.every(f =>
      f.currentReading == null &&
      (!f.totalAmount || f.totalAmount === 0) &&
      f.isPaid === false
    );
  }
  

  async reInitializeMonth(month: string) {
    this.selectedMonth = month;
    await this.initializeNewBillingCycle(); 
  }
  
  // async deleteBillingCycle(month: string) {
  //   const confirmed = this.modalService.show(`Are you sure you want to delete billing data for ${month}?`,'confirm');
  //   if (!confirmed) return;
  
  //   for (const flat of this.availableFlats) {
  //     const ref = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/flatOwners/${flat.id}/monthlyExpenses/${month}`);
  //     await setDoc(ref, {}, { merge: false }); // OR use deleteDoc(ref) if preferred
  //   }
  
  //   delete this.waterBillData[month];
  //   this.monthsInView = this.monthsInView.filter(m => m !== month);
  //   this.statusMessage = `🗑️ Deleted billing data for ${month}`;
  // }

  // applySettingsToAll() {
  //   for (const month of this.monthsInView) {
  //     const monthData = this.waterBillData[month];
  //     if (!Array.isArray(monthData)) continue;
  
  //     for (const flat of monthData) {
  //       this.calculateForFlat(flat, month);
  //     }
  //   }
  //   this.statusMessage = '✅ Global water bill settings applied to all months.';
  // }
  
  
  /**end */

  async getUpi() {
  if (!this.adminApartmentId) {
    console.warn('Apartment ID not set');
    return;
  }
  
  try {
    const apartmentRef = doc(this.firestoreService.getFirestore(), 'apartments', this.adminApartmentId);
    const docSnap = await getDoc(apartmentRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      this.upiId = data['upiId'] || '';
      this.upiProvider = data['upiProvider'] || 'PhonePe';
      this.paymentId =  this.upiId ;
      console.log('Loaded UPI info:', data);
    } else {
      console.log('No UPI info found for this apartment.');
    }
  } catch (error) {
    console.error('Error loading UPI info:', error);
  }
}
async deleteUpi() {
  try {
    if (!this.adminApartmentId) {
      throw new Error('Apartment ID not set');
    }

    const apartmentRef = doc(this.firestoreService.getFirestore(), 'apartments', this.adminApartmentId);

    // Delete only upiId and upiProvider fields
    await updateDoc(apartmentRef, {
      upiId: deleteField(),
      upiProvider: deleteField()
    });

    // Clear local UI state
    this.upiId = '';
    this.upiProvider = 'PhonePe'; // reset to default
    this.paymentId = null;

    console.log('UPI info deleted successfully!');
  } catch (error) {
    console.error('Error deleting UPI info:', error);
  }
}
  async saveUpi() {
    try {
      if (!this.adminApartmentId) {
        throw new Error('Apartment ID is not defined');
      }
  
      const apartmentRef = doc(
        this.firestoreService.getFirestore(),
        'apartments',
        this.adminApartmentId
      );
  
      await setDoc(apartmentRef, {
        upiId: this.upiId,
        upiProvider: this.upiProvider
      }, { merge: true });
     this.getUpi();
      console.log('UPI info saved successfully!');
    } catch (error) {
      console.error('Error saving UPI info:', error);
    }
  }
  
  handleExcelUpload(event: any): void {
    this.invalidRows = [];
    const flatNumberSet = new Set<string>();
    const duplicateFlats: string[] = [];
  
    const target: DataTransfer = <DataTransfer>(event.target);
    const reader: FileReader = new FileReader();
  
    reader.onload = (e: any) => {
      const bstr: string = e.target.result;
      const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
      const wsname: string = wb.SheetNames[0];
      const ws: XLSX.WorkSheet = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json(ws, { raw: true });
  
      this.excelFlatOwners = rawData.map((row: any, index: number) => {
        const errors: string[] = [];
        const flat = (row.FlatNumber || '').toString().trim();
  
        if (!row.Name || row.Name.trim() === '') {
          errors.push('Name required');
        }
        if (!/^\d{10}$/.test(row.PhoneNumber)) {
          errors.push('Phone must be 10 digits');
        }
        if (!flat) {
          errors.push('Flat Number required');
        } else {
          if (flatNumberSet.has(flat)) {
            errors.push('Duplicate Flat Number');
            duplicateFlats.push(flat);
          } else {
            flatNumberSet.add(flat);
          }
        }
  
        if (errors.length > 0) {
          this.invalidRows.push({ ...row, __rowNum__: index + 2, errors });
        }
  
        return row;
      });
  
      if (duplicateFlats.length > 0) {
        console.warn('Duplicates found:', duplicateFlats);
      }
    };
  
    reader.readAsBinaryString(target.files[0]);
  }
  isRowInvalid(flatNumber: string): boolean {
    return this.invalidRows.some(row => row.FlatNumber === flatNumber);
  }
  

async uploadExcelData() {
  if (this.invalidRows.length > 0) {
    this.modalService.show('Fix validation errors before uploading', 'error');
    return;
  }

  const confirmed = confirm(`Upload ${this.excelFlatOwners.length} owners to Firestore?`);
  if (!confirmed) return;

  for (const owner of this.excelFlatOwners) {
    const docRef = doc(this.firestoreService.getFirestore(), 'flatOwners', owner.FlatNumber);
    await setDoc(docRef, {
      name: owner.Name,
      phone: owner.PhoneNumber,
      flatNumber: owner.FlatNumber,
      role: owner.Role || 'resident'
    }, { merge: true });
  }

  this.modalService.show('Owners uploaded successfully!','success');
  this.excelFlatOwners = [];
}

  downloadTemplate() {
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet([
      { Name: '', PhoneNumber: '', FlatNumber: '', Role: 'Resident' }
    ]);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OwnersTemplate');
  
    const excelBuffer: any = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob: Blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, 'FlatOwnersTemplate.xlsx');
  }
  
  postAnnouncement() {
    if (!this.announcementMessage.trim()) return;
  
    if (!this.expiresAt) {
      this.modalService.show('Please select an expiry date.',  'warning');
      return;
    }
  
    const newAnnouncement = {
      message: this.announcementMessage,
      postedAt: new Date(),
      createdBy: this.adminName,
      showAsBanner: this.showAsBanner ?? false,
      expiresAt: new Date(this.expiresAt) // convert input string to Date
    };
  
    this.firestoreService.postAnnouncement(this.adminApartmentId!, newAnnouncement)
      .then(() => {
        this.announcementMessage = '';
        this.expiresAt = '';
        this.showAsBanner = false;
        this.modalService.show('📢 Announcement posted successfully!', 'success');
      })
      .catch(() => {
        this.modalService.show('Failed to post announcement.', 'error');
      });
  }
  
  toggleWaterSection(): void {
    this.isWaterSectionOpen = !this.isWaterSectionOpen;
  }

  copyTotalAmount(amount: number | null): void {
    if (amount === null) {
      console.warn('Nothing to copy: amount is null');
      return;
    }
  
    const formatted = `₹${amount.toFixed(2)}`;
    navigator.clipboard.writeText(formatted).then(() => {
    });
  }
  
  
  loadAnnouncements() {
    this.firestoreService.getAnnouncements(this.adminApartmentId!).subscribe(data => {
      this.announcements = data;
    });
  }

  loadRSVPs(announcementId: string) {
    this.firestoreService.getRSVPs(this.adminApartmentId!, announcementId).subscribe(rsvps => {
      const announcement = this.announcements.find(a => a.id === announcementId);
      if (announcement) announcement.rsvps = rsvps;
      
    });
  }
  getAnnouncementsWithRSVPs(apartmentId: string) {
    this.firestoreService.getAnnouncements(apartmentId).subscribe(announcements => {
      announcements.forEach(announcement => {
        this.firestoreService.getRSVPs(apartmentId, announcement.id).subscribe(rsvps => {
          announcement['rsvps'] = rsvps;
        });
      });
  
      this.announcements = announcements;
    });
  }
  
  
  // calculateWaterBill(): void {
  //   this.calculationError = '';
  //   this.isCalculating = true;
  
  //   setTimeout(() => {
  //     const usage = this.currentReading - this.previousReading;
  
  //     if (usage < 0 || isNaN(usage)) {
  //       this.calculationError = 'Invalid meter readings';
  //       this.isCalculating = false;
  //       return;
  //     }
  
  //     let amount = usage * this.waterTariffPerLiter;
  //     this.thresholdExceeded = usage > this.waterUsageThreshold;
  
  //     if (this.thresholdExceeded) {
  //       amount += this.extraWaterCharge;
  //     }
  
  //     this.totalUsage = usage;
  //     this.totalAmount = amount;
  //     this.isCalculating = false;
  //   }, 500);
  // }
  
  calculateWaterBill(): void {
    this.calculationError = '';
    this.isCalculating = true;
  
    setTimeout(() => {
      const usage = this.currentReading - this.previousReading;
  
      if (usage < 0 || isNaN(usage)) {
        this.calculationError = 'Invalid meter readings';
        this.isCalculating = false;
        return;
      }
  
      this.thresholdExceeded = usage > this.waterUsageThreshold;
  
      let amount = 0;
      let exceededLiters = 0;
  
      if (this.thresholdExceeded) {
        exceededLiters = usage - this.waterUsageThreshold;
        amount = exceededLiters * this.waterTariffPerLiter;
  
        if (this.extraWaterCharge && this.extraWaterCharge > 0) {
          amount += this.extraWaterCharge;
        }
      }
  
      this.totalUsage = usage;
      this.exceededLiters = exceededLiters;
      this.totalAmount = amount;
      this.isCalculating = false;
    }, 500);
  }
  

  resetWaterBill() {
    this.previousReading = 0;
    this.currentReading = 0;
    this.waterTariffPerLiter = 0;
    this.totalUsage = null;
    this.totalAmount = null;
    this.calculationError = '';
  }

 

  async loadMonthlyExpenses() {
    const apartmentId = this.adminApartmentId!;
    const yearMonthKey = this.getCurrentMonthKey();
    const [year, month] = yearMonthKey.split('-');
  
    if (!this.groupedExpenses[year]) this.groupedExpenses[year] = {};
    this.groupedExpenses[year][month] = [];
  
    try {
      const flatOwners = await firstValueFrom(this.firestoreService.getFlatOwners(apartmentId));
  
      const expensePromises = flatOwners.map(async (owner: any) => {
        const expensePath = `apartments/${apartmentId}/flatOwners/${owner.id}/monthlyExpenses/${yearMonthKey}`;
        const doc = await this.firestoreService.getDocument(expensePath);
  
        const regularItems = doc?.['items'] ?? [];
        const waterBillAmount = (doc?.['usage'] ?? 0) > 0 ? (doc?.['totalAmount'] ?? 0) : 0;
        
        const manualTotal = regularItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        const grandTotal = manualTotal + waterBillAmount;
        

        const waterExpense = (doc?.['usage'] ?? 0) > 0
          ? {
              title: 'Water Bill',
              amount: doc?.['totalAmount'] ?? 0,
              isSplit: false,
              isWater: true,  // optional flag
              createdAt: doc?.['createdDate'] ? new Date(doc['createdDate']) : null
            }
          : null;
        
  
        const combinedItems = [...regularItems];
        if (waterExpense) {
          combinedItems.push(waterExpense);
        }
  
        return {
          ownerId: owner.id,
          ownerName: owner.name,
          flat: owner.flat,
          totalAmount: grandTotal,
          items: [...regularItems, ...(waterBillAmount ? [{
            title: 'Water Bill',
            amount: waterBillAmount,
            isSplit: false,
            isWater: true,
            createdAt: doc?.['createdDate'] ? new Date(doc['createdDate']) : null
          }] : [])]
        };
        
      });
  
      const allExpenses = await Promise.all(expensePromises);
      this.groupedExpenses[year][month] = allExpenses;
      console.log("Loaded expenses for", yearMonthKey, allExpenses);
  
    } catch (err) {
      console.error("Error loading expenses:", err);
    }
  }
  

  // loadMonthlyExpenses() {
  //   const apartmentId = this.adminApartmentId!;
  //   const yearMonthKey = this.getCurrentMonthKey();
  //   const [year, month] = yearMonthKey.split('-');
  
  
  //   if (!this.groupedExpenses[year]) this.groupedExpenses[year] = {};
  //   this.groupedExpenses[year][month] = [];
  
  //   this.firestoreService.getFlatOwners(apartmentId).subscribe(flatOwners => {
  //     flatOwners.forEach(owner => {
  //       const expensePath = `apartments/${apartmentId}/flatOwners/${owner.id}/monthlyExpenses/${yearMonthKey}`;
  
  //       this.firestoreService.getDocument(expensePath).then((doc: any) => {
  //         this.groupedExpenses[year][month].push({
  //           ownerId: owner.id,
  //           ownerName: owner.name,
  //           flat: owner.flat,
  //           totalAmount: doc?.totalAmount ?? 0,
  //           items: doc?.items ?? []
  //         });
  //       });
  //     });
  //   });
  // }

  getMonthlyTotal(year: string, month: string): string {
    const expenses = this.groupedExpenses[year]?.[month] || [];
    const total = expenses.reduce((sum, entry) => sum + (entry.totalAmount || 0), 0);
    return total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  getYearlyTotal(year: string): string {
    const months = this.groupedExpenses[year] || {};
    let total = 0;
  
    for (const month in months) {
      const expenses = months[month];
      total += expenses.reduce((sum, entry) => sum + (entry.totalAmount || 0), 0);
    }
  
    return total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  
  
  private async checkAdminByPhone(firestore: Firestore, phone: string): Promise<boolean> {
      const apartmentsRef = collection(firestore, 'apartments');
      const apartmentSnapshots = await getDocs(apartmentsRef);
    
      for (const apartmentDoc of apartmentSnapshots.docs) {
        const apartmentId = apartmentDoc.id;
        const apartmentData = apartmentDoc.data();
        const adminsRef = collection(firestore, 'apartments', apartmentId, 'admins');
        const adminQuery = query(adminsRef, where('phoneNumber', '==', phone));
        const adminSnapshot = await getDocs(adminQuery);
    
        if (!adminSnapshot.empty) {
          const adminData = adminSnapshot.docs[0].data();
    
          // this.apartmentName = apartmentData['name'] || null;
          // this.apartmentId = apartmentId;
          // this.role = adminData['adminRole'] || 'Admin';
          // this.currentUser = {
          //   role: adminData['adminRole'] || 'Admin',
          //   apartment: apartmentId
          // };
    
          console.log('Logged in as Admin:', adminData);
          return true;
        }
      }
      return false;
    }

    toggleAddOwner() {
      this.showAddOwner = !this.showAddOwner;
    }


    submitRequest() {
      if (this.maintenanceIssue.trim()) {
        this.modalService.show('🛠️ Maintenance request submitted: ' + this.maintenanceIssue, 'success');
        this.maintenanceIssue = '';
      } else {
        this.modalService.show('❗ Please enter a maintenance issue before submitting.', 'warning');
      }
    }
    
  
  submitFeedback() {
    if (this.feedback.trim()) {
      this.modalService.show('Feedback submitted: ' + this.feedback,'success');
      this.feedback = '';
    }
  }

  submitAdminQuery() {
    if (!this.adminQueryMessage || this.adminQueryMessage.trim().length < 10) {
      this.modalService.show('❌ Please enter at least 10 characters for your query.', 'warning');
      return;
    }
  
    const queryData: AdminQuery = {
      apartment: this.apartmentName,
      adminPhone: this.phoneNumber,
      message: this.adminQueryMessage.trim(),
      status: 'Pending',
      timestamp: Date.now()
    };
  
    console.log(queryData);
  
    this.firestoreService.submitAdminQuery(queryData).then(() => {
      this.modalService.show('✅ Your query has been submitted successfully!', 'success');
      this.adminQueryMessage = '';
      this.loadAdminQueries();
    }).catch(error => {
      console.error('Error submitting admin query:', error);
      this.modalService.show('❌ Failed to submit your query. Please try again.', 'error');
    });
  }
  

  loadAdminQueries() {
    this.firestoreService.getAdminQueries(this.apartmentName, this.phoneNumber).then(snapshot => {
      this.adminQueries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AdminQuery[];
    });
  }
  
  

  // Announcement methods
  //postAnnouncement() {
  //   if (this.announcementMessage) {
  //     this.announcements.unshift(this.announcementMessage);
  //     this.announcementMessage = '';
  //   }
  // }

  // Flat Owner methods
  // addFlatOwner() {
  //   if (!this.newOwnerName || !this.newOwnerPhone) return;

  // this.flatOwners.push({
  //   name: this.newOwnerName,
  //   phone: this.newOwnerPhone,
  //   isAdmin: this.newOwnerIsAdmin
  // });

  // this.newOwnerName = '';
  // this.newOwnerPhone = '';
  // this.newOwnerIsAdmin = false;
  // }

 
  // makeAdmin(index: number) {
  //   this.flatOwners[index].isAdmin = true;
  // }
  
  // revokeAdmin(index: number) {
  //   this.flatOwners[index].isAdmin = false;
  // }
  
  async makeAdmin(index: number): Promise<void> {
    const flatOwnerToUpdate = this.flatOwners[index];
  
    if (!flatOwnerToUpdate) {
      this.modalService.show('❌ Flat owner not found.', 'error');
      return;
    }
  
    if (flatOwnerToUpdate.role === 'admin') {
      this.modalService.show(`${flatOwnerToUpdate.name} is already an admin.`, 'warning');
      return;
    }
  
    const confirm = await this.modalService.show(
      `Are you sure you want to make ${flatOwnerToUpdate.name} (Flat ${flatOwnerToUpdate.flat}) an Admin?`,
      'confirm',
      'Make Admin'
    ) as boolean;
  
    if (!confirm) return;
  
    try {
      // Step 1: Update flatOwner role
      await this.firestoreService.updateFlatOwnerRole(flatOwnerToUpdate.id, 'admin');
      flatOwnerToUpdate.role = 'admin';

  
      // Step 2: Create admin document
      const adminId = uuidv4(); // or any unique ID method you're using
      const adminRef = doc(
        this.firestoreService.getFirestore(),
        `apartments/${this.adminApartmentId}/admins/${adminId}`
      );
      const now = new Date();
      const apartmentRef = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/admins/${adminId}`);
      await setDoc(adminRef, {
        adminName: flatOwnerToUpdate.name,
        phoneNumber: flatOwnerToUpdate.phoneNumber,
        adminRole: 'admin',
        flatNumber: flatOwnerToUpdate.flat,
        flatOwnerId: flatOwnerToUpdate.id,
        apartmentName: this.apartmentDetails?.name || '',
        approved: true,  
        approvalStatus: 'approved',  
        creationDate: now.toISOString()
      });
  
      flatOwnerToUpdate.role = 'admin';
      this.modalService.show(`✅ ${flatOwnerToUpdate.name} has been made an Admin.`, 'success');
    } catch (err) {
      console.error(err);
      this.modalService.show(`❌ Failed to make ${flatOwnerToUpdate.name} an admin.`, 'error');
    }
  }
  
  
  
  

  // New method to remove admin (good to have if you make someone admin)
  async removeAdmin(index: number): Promise<void> {
    const flatOwnerToUpdate = this.flatOwners[index];
  
    if (!flatOwnerToUpdate) {
      console.error('Flat owner not found at index:', index);
      this.modalService.show('❌ Flat owner not found.', 'error');
      return;
    }
  
    if (flatOwnerToUpdate.role === 'resident') {
      this.modalService.show(`${flatOwnerToUpdate.name} is not an admin.`, 'warning');
      return;
    }
  
    const confirmRemoveAdmin = await this.modalService.show(
      `Are you sure you want to revoke admin access for ${flatOwnerToUpdate.name} (Flat ${flatOwnerToUpdate.flat})?`,
      'confirm',
      'Revoke Admin Access'
    ) as boolean;
  
    if (!confirmRemoveAdmin) return;
  
    try {
      // 1. Update flatOwner role to 'resident'
      await this.firestoreService.updateFlatOwnerRole(flatOwnerToUpdate.id, 'resident');
      flatOwnerToUpdate.role = 'resident';
  
      // 2. Delete admin document by flatOwnerId
      const adminSnapshot = await getDocs(
        query(
          collection(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/admins`),
          where('flatOwnerId', '==', flatOwnerToUpdate.id)
        )
      );
  
      for (const docSnap of adminSnapshot.docs) {
        await deleteDoc(docSnap.ref);
      }
  
      this.modalService.show(`✅ Admin access revoked for ${flatOwnerToUpdate.name}.`, 'success');
    } catch (error) {
      console.error(`Error revoking admin access for ${flatOwnerToUpdate.name}:`, error);
      this.modalService.show(`❌ Failed to revoke admin access for ${flatOwnerToUpdate.name}. Please try again.`, 'error');
    }
  }
  
  
  
  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }
  getLoggedInAdminPhoneNumberAndApartmentId() {
    this.authService.currentUser.pipe(
      switchMap((user) => {
        if (user && user.phoneNumber) {
          console.log('Logged-in phone number:', user.phoneNumber);
          this.loggedInAdminPhoneNumber = user.phoneNumber;

          // Format phone number if needed
          const formattedPhone = user.phoneNumber.replace('+91', '');
          
          // Firestore query to find the admin's apartment
          const apartmentsRef = collection(this.firestoreService.getFirestore(), 'apartments');
          const adminQuery = query(apartmentsRef, where('phoneNumber', '==', formattedPhone));

          return from(getDocs(adminQuery));  // Perform Firestore query
        } else {
          console.warn('No logged-in user or phone number found.');
          return of(null);  // Return an observable of null if no user is logged in
        }
      })
    ).subscribe(
      (querySnapshot) => {
        if (querySnapshot && !querySnapshot.empty) {
          const apartmentDoc = querySnapshot.docs[0];
          this.adminApartmentId = apartmentDoc.id;
          console.log('Found apartment ID:', this.adminApartmentId);
          this.loadFlatOwners();
        } else {
          console.error('Admin apartment not found based on phone number.');
        }
      },
      (error) => {
        console.error('Error fetching admin apartment:', error);
      }
    );
  }

  
  

  // loadFlatOwners() {
  //   if (this.adminApartmentId) {
  //     this.firestoreService.getFlatOwners(this.adminApartmentId).subscribe(owners => {
  //       this.flatOwners = owners;
  //     });
  //   }
  // }


  
  // async addFlatOwner() {
   
  //   if (
  //     this.newOwnerName &&
  //     this.newOwnerPhone &&
  //     this.newOwnerFlat &&
  //     this.newOwnerRole &&
  //     this.adminApartmentId // Use the admin's apartment ID
  //   ) {
  //     const newOwner = {
  //       name: this.newOwnerName,
  //       phone: this.newOwnerPhone,
  //       flat: this.newOwnerFlat,
  //       role: this.newOwnerRole // Include the role here
  //     };

  //     this.firestoreService.addFlatOwner(this.adminApartmentId, newOwner).then(() => {
  //       this.loadFlatOwners();
  //       this.clearForm();
  //     }).catch(error => {
  //       console.error('Error adding flat owner:', error);
  //       alert('Failed to add flat owner. Please try again.');
  //     });
  //   } else {
  //     alert('Please fill in all required fields.');
  //     if (!this.adminApartmentId) {
  //       alert('Error: Admin Apartment ID is not available.');
  //     }
  //   }
  // }

  async loadFlatOwners() {
    if (this.adminApartmentId) {
      
      
      const ownersSnapshot = await getDocs(collection(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/flatOwners`));
      this.flatOwners = ownersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      this.flatOwners = await firstValueFrom(this.firestoreService.getFlatOwners(this.adminApartmentId!));
      if (this.flatOwners.some(owner => !!owner.block)) {
        this.blockModeEnabled = true;
      }
      if (this.blockModeEnabled) {
        this.blockList = Array.from(new Set(this.flatOwners.map(o => o.block).filter(b => !!b))).sort();
      }
    }
  }
  
  
  // async addFlatOwner() {
  //   if (
  //     this.newOwnerName &&
  //     this.newOwnerPhone &&
  //     this.newOwnerFlat &&
  //     this.newOwnerRole &&
  //     this.adminApartmentId
  //   ) {
  //     const ownerData = {
  //       name: this.newOwnerName,
  //       phoneNumber: this.newOwnerPhone, 
  //       flat: this.newOwnerFlat,
  //       role: this.newOwnerRole
  //     };
  
  //     try {
  //       if (this.selectedOwnerId) {
      
  //         await this.firestoreService.updateFlatOwner(this.adminApartmentId, this.selectedOwnerId, ownerData);
  //       } else {
        
  //         await this.firestoreService.addFlatOwner(this.adminApartmentId, ownerData);
  //       }
  
  //       this.loadFlatOwners();
  //       this.loadMonthlyExpenses();
  //       this.clearForm();
  
  //     } catch (error) {
  //       console.error('Error saving flat owner:', error);
  //       alert('Failed to save flat owner. Please try again.');
  //     }
  //   } else {
  //     alert('Please fill in all required fields.');
  //     if (!this.adminApartmentId) {
  //       alert('Error: Admin Apartment ID is not available.');
  //     }
  //   }
  // }
  
  async addFlatOwner() {
    if (
      this.newOwnerName &&
      this.newOwnerPhone &&
      this.newOwnerFlat &&
      this.newOwnerSqft &&
      this.newOwnerRole &&
      this.adminApartmentId
    ) {
      const now = new Date();
  
      const ownerData: any = {
        name: this.newOwnerName,
        phoneNumber: this.newOwnerPhone,
        flat: this.newOwnerFlat,
        sqft: this.newOwnerSqft,
        role: this.newOwnerRole,
        apartmentId: this.adminApartmentId,
        createdAt: now.toISOString()
      };
  
      // Include block if Block Mode is enabled
      if (this.blockModeEnabled) {
        ownerData.block = this.newOwnerBlock?.trim() || '';
      }
  
      try {
        if (this.selectedOwnerId) {
          // Edit mode
          await this.firestoreService.updateFlatOwner(this.adminApartmentId, this.selectedOwnerId, ownerData);
          await this.firestoreService.updateUserIndex(
            ownerData.phoneNumber,
            ownerData.role,
            'flatOwner',
            this.adminApartmentId,
            this.selectedOwnerId,
            this.apartmentName,
            ownerData.flat,
            ownerData.sqft,
            ownerData.name
          );
          this.modalService.show('✅ Flat owner updated successfully!', 'success');
        } else {
          // Add new owner
          const newOwnerRef = await this.firestoreService.addFlatOwner(this.adminApartmentId, ownerData);
          const newOwnerId = newOwnerRef.id;
  
          await this.firestoreService.updateUserIndex(
            ownerData.phoneNumber,
            ownerData.role,
            'flatOwner',
            this.adminApartmentId,
            newOwnerId,
            this.apartmentName,
            ownerData.flat,
            ownerData.sqft,
            ownerData.name
          );
          this.modalService.show('✅ Flat owner added successfully!', 'success');
        }
  
        this.loadFlatOwners();
        this.loadMonthlyExpenses();
        this.clearForm();
  
      } catch (error) {
        console.error('Error saving flat owner:', error);
        this.modalService.show('❌ Failed to save flat owner. Please try again.', 'error');
      }
  
    } else {
      this.modalService.show('⚠️ Please fill in all required fields.', 'warning');
      if (!this.adminApartmentId) {
        this.modalService.show('❌ Error: Admin Apartment ID is not available.', 'error');
      }
    }
  }
  
  
  
  // ✅ Updated saveEditedOwner to receive oldPhoneNumber
saveEditedOwner(oldPhoneNumber: string) {
  if (!this.editingOwner) return;

  const apartmentId = this.editingOwner['apartmentId'] || this.adminApartmentId;
  const newPhoneNumber = this.editingOwner['phoneNumber'];

  if (!apartmentId || !oldPhoneNumber) {
    this.modalService.show('Missing phone number or apartment ID', 'error');
    return;
  }

  this.firestoreService.getFlatOwnerIdByPhone(apartmentId, oldPhoneNumber)
    .then(flatOwnerId => {
      if (!flatOwnerId) {
        this.modalService.show('Flat owner not found', 'error');
        return;
      }

      this.firestoreService.updateFlatOwner(apartmentId, flatOwnerId, this.editingOwner)
        .then(() => {
          this.loadFlatOwners();
          this.cancelEdit();
        })
        .catch(err => {
          console.error('Failed to update owner', err);
          this.modalService.show('Update failed', 'error');
        });
    })
    .catch(err => {
      console.error('Error looking up owner ID', err);
      this.modalService.show('Lookup failed', 'error');
    });
}

  
  cancelEdit() {
    this.editingOwner = null;
    this.editingOwnerIndex = null;
  }
  

  async deleteFlatOwner(index: any) {
    if (!this.adminApartmentId) {
      console.log('Apartment ID is missing!');
      return;
    }
    this.deletingOwner = { ...this.flatOwners[index] };
    let deletingOwnerId = this.flatOwners[index].id;
    let deletingOwnerIndex = index; // ✅ Store the index for use during save
    this.oldPhoneNumber = this.deletingOwner.phoneNumber;

    const confirmed = await this.modalService.show(`Are you sure you want to delete ${this.deletingOwner['name']}?`,'confirm');
    if (confirmed) {
      this.firestoreService.deleteFlatOwner(this.adminApartmentId, deletingOwnerId,this.oldPhoneNumber).then(() => {
        this.loadFlatOwners();
      }).catch(error => {
        console.error('Error deleting flat owner:', error);
        this.modalService.show('Failed to delete flat owner.','error');
      });
    }
  }
  

  editFlatOwner(index: number) {
    this.editingOwner = { ...this.flatOwners[index] };
    this.editingOwnerId = this.flatOwners[index].id;
    this.editingOwnerIndex = index; // ✅ Store the index for use during save
    this.oldPhoneNumber = this.editingOwner.phoneNumber;
    this.showEditModal = true;
  }
  
  filteredFlatOwners() {
    if (!this.blockModeEnabled || !this.selectedBlockFilter) {
      return this.flatOwners;
    }
    return this.flatOwners.filter(o => o.block === this.selectedBlockFilter);
  }
  updateFlatOwner() {
    if (this.editingOwnerId) {
      const updatedOwner = {
        name: this.newOwnerName,
        phoneNumber: this.newOwnerPhone, // ✅ Corrected
        flat: this.newOwnerFlat
      };
  
      this.firestoreService.updateFlatOwner(this.apartmentName, this.editingOwnerId, updatedOwner).then(() => {
        this.loadFlatOwners();
        this.clearForm();
      });
    }
  }
  

// deleteFlatOwner(index: number) {
//   const owner = this.flatOwners[index];
//   if (owner.id && confirm('Are you sure you want to delete this owner?')) {
//     this.firestoreService.deleteFlatOwner(this.apartmentName, owner.id).then(() => {
//       this.loadFlatOwners();
//     });
//   }
// }

clearForm() {
  this.newOwnerName = '';
  this.newOwnerPhone = '';
  this.newOwnerFlat = '';
  this.isEditing = false;
  this.editingIndex = null;
  this.newOwnerBlock = ''; 
  this.newOwnerRole = '';
  this.editingOwnerId = null;
}


async loadExpenses() {
  const apartmentId = this.adminApartmentId!;
  const expensesRef = collection(this.firestoreService.getFirestore(), `apartments/${apartmentId}/expenses`);
  const snapshot = await getDocs(expensesRef);

  this.expenses = snapshot.docs.map(doc => {
    const data = doc.data();
    const flatOwners = data['flatOwners'] || {};

   
    const sortedFlatOwnersEntries = Object.entries(flatOwners).sort(([, a], [, b]) => {
      const ownerA = a as { flat: string };
      const ownerB = b as { flat: string };

      const flatA = isNaN(+ownerA.flat) ? ownerA.flat : +ownerA.flat;
      const flatB = isNaN(+ownerB.flat) ? ownerB.flat : +ownerB.flat;

      return flatA > flatB ? 1 : flatA < flatB ? -1 : 0;
    });

    const sortedFlatOwners = Object.fromEntries(sortedFlatOwnersEntries);

    return {
      id: doc.id,
      ...data,
      flatOwners: sortedFlatOwners,
      createdAt: data['createdAt']?.toDate?.() || new Date()
    };
  });

  this.groupExpensesByYearAndMonth();
}


groupExpensesByYearAndMonth() {
  this.groupedExpenses = {}; // reset

  this.expenses.forEach(expense => {
    const date = new Date(expense.createdAt);
    const year = date.getFullYear().toString();
    // Get month name, e.g. "January"
    const month = date.toLocaleString('default', { month: 'long' });

    if (!this.groupedExpenses[year]) {
      this.groupedExpenses[year] = {};
    }
    if (!this.groupedExpenses[year][month]) {
      this.groupedExpenses[year][month] = [];
    }

    this.groupedExpenses[year][month].push(expense);
  });
}

getYears() {
  return Object.keys(this.groupedExpenses).sort((a, b) => +b - +a); // descending years
}

getMonths(year: string) {
  return Object.keys(this.groupedExpenses[year]);
}


// editExpense(index: number, expenseId: string) {
//   // this.editIndex = index;
//   // this.editingExpenseId = expenseId;
//   // const expense = this.expenses.find(e => e.id === expenseId);
//   // if (expense) {
//   //   this.editTitle = expense.title;
//   //   this.editAmount = expense.amount;
//   // }
// }

// async addExpense() {
//   if (!this.newExpenseName || !this.expenseAmount) return;

//   const apartmentId = this.adminApartmentId!;
//   const monthKey = this.getCurrentMonthKey();

//   const ownersObservable = this.firestoreService.getFlatOwners(apartmentId);
//   const allFlatOwners = await firstValueFrom(ownersObservable);

//   const targetOwners = this.selectedFlatId
//     ? allFlatOwners.filter(owner => owner.id === this.selectedFlatId)
//     : allFlatOwners;

//   await Promise.all(
//     targetOwners.map(async (owner: any) => {
//       const docRef = doc(
//         this.firestoreService.getFirestore(),
//         `apartments/${apartmentId}/flatOwners/${owner.id}/monthlyExpenses/${monthKey}`
//       );

//       const docSnap = await getDoc(docRef);
//       const existingData = docSnap.exists() ? docSnap.data() : { items: [], totalAmount: 0 };

//       const newItem = {
//         title: this.newExpenseName,
//         amount: this.expenseAmount
//       };

//       await setDoc(docRef, {
//         ...existingData,
//         month: monthKey,
//         items: [...(existingData['items'] || []), newItem],
//         totalAmount: (existingData['totalAmount'] || 0) + this.expenseAmount
//       });
//     })
//   );


//   this.newExpenseName = '';
//   this.expenseAmount = null;
//   this.selectedFlatId = null;

//   await this.loadMonthlyExpenses(); 
// }


// async addExpense() {
//   if (!this.newExpenseName || !this.expenseAmount) return;

//   const apartmentId = this.adminApartmentId!;
//   const monthKey = this.getCurrentMonthKey();

//   const ownersObservable = this.firestoreService.getFlatOwners(apartmentId);
//   const allFlatOwners = await firstValueFrom(ownersObservable);

//   const isSplit = this.splitEqually;
//   const totalAmount = this.expenseAmount;
//   const splitAmount = isSplit ? +(totalAmount / allFlatOwners.length).toFixed(2) : totalAmount;

//   const targetOwners = isSplit
//     ? allFlatOwners
//     : this.selectedFlatId
//       ? allFlatOwners.filter(owner => owner.id === this.selectedFlatId)
//       : allFlatOwners;

//   await Promise.all(
//     targetOwners.map(async (owner: any) => {
//       const docRef = doc(
//         this.firestoreService.getFirestore(),
//         `apartments/${apartmentId}/flatOwners/${owner.id}/monthlyExpenses/${monthKey}`
//       );

//       const docSnap = await getDoc(docRef);
//       const existingData = docSnap.exists() ? docSnap.data() : { items: [], totalAmount: 0 };

//       const newItem: any = {
//       title: this.newExpenseName,
//       amount: splitAmount,
//       isSplit: isSplit
//       };

//       if (isSplit) {
//         newItem.originalAmount = totalAmount;
//       }

//       await setDoc(docRef, {
//         ...existingData,
//         month: monthKey,
//         items: [...(existingData['items'] || []), newItem],
//         totalAmount: (existingData['totalAmount'] || 0) + splitAmount
//       });
//     })
//   );

  // Reset form
//   this.newExpenseName = '';
//   this.expenseAmount = null;
//   this.selectedFlatId = null;
//   this.splitEqually = false;

//   await this.loadMonthlyExpenses();
// }

sortExpenses(key: keyof typeof this.pendingExpenses[0]) {
  this.sortAsc = this.sortKey === key ? !this.sortAsc : true;
  this.sortKey = key;

  this.sortedPendingExpenses = [...this.pendingExpenses].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (typeof aVal === 'string') {
      return this.sortAsc ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
    } else {
      return this.sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    }
  });
}

addExpense() {
  if (!this.newExpenseName || !this.expenseAmount || this.expenseAmount <= 0) {
    this.modalService.show('Please enter a valid expense name and amount.','warning');
    return;
  }

  this.pendingExpenses.push({
    title: this.newExpenseName,
    amount: this.expenseAmount,
    flatId: this.selectedFlatId,
    isSplit: this.splitEqually,
    originalAmount: this.splitEqually ? this.expenseAmount : undefined
  });

  // Clear inputs
  this.newExpenseName = '';
  this.expenseAmount = null;
  this.selectedFlatId = null;
  this.splitEqually = false;
}

// async savePendingExpenses() {
//   const apartmentId = this.adminApartmentId!;
//   const monthKey = this.getCurrentMonthKey();

//   const ownersObservable = this.firestoreService.getFlatOwners(apartmentId);
//   const allFlatOwners = await firstValueFrom(ownersObservable);
//   const now = new Date(); 

//   for (const exp of this.pendingExpenses) {
//     const isSplit = exp.isSplit;
//     const splitAmount = isSplit ? +(exp.amount / allFlatOwners.length).toFixed(2) : exp.amount;

//     const targetOwners = isSplit
//       ? allFlatOwners
//       : exp.flatId
//         ? allFlatOwners.filter(owner => owner.id === exp.flatId)
//         : allFlatOwners;

//     for (const owner of targetOwners) {
//       const docRef = doc(
//         this.firestoreService.getFirestore(),
//         `apartments/${apartmentId}/flatOwners/${owner.id}/monthlyExpenses/${monthKey}`
//       );

//       const docSnap = await getDoc(docRef);
//       const existingData = docSnap.exists() ? docSnap.data() : { items: [], totalAmount: 0 };

//       const newItem: any = {
//         title: exp.title,
//         amount: splitAmount,
//         isSplit: exp.isSplit
//       };

//       if (exp.isSplit) {
//         newItem.originalAmount = exp.amount;
//       }

//       await setDoc(docRef, {
//         ...existingData,
//         month: monthKey,
//         items: [...(existingData['items'] || []), newItem],
//         totalAmount: (existingData['totalAmount'] || 0) + splitAmount
//       });
//     }
//   }

//   this.pendingExpenses = [];
//   await this.loadMonthlyExpenses();
//   this.modalService.show('✅ All expenses saved successfully.','success');
// }
async savePendingExpenses() {
  const apartmentId = this.adminApartmentId!;
  const monthKey = this.getCurrentMonthKey();

  const ownersObservable = this.firestoreService.getFlatOwners(apartmentId);
  const allFlatOwners = await firstValueFrom(ownersObservable);

  const now = new Date(); // 📌 One consistent timestamp for this batch

  for (const exp of this.pendingExpenses) {
    const isSplit = exp.isSplit;
    const splitAmount = isSplit ? +(exp.amount / allFlatOwners.length).toFixed(2) : exp.amount;

    const targetOwners = isSplit
      ? allFlatOwners
      : exp.flatId
        ? allFlatOwners.filter(owner => owner.id === exp.flatId)
        : allFlatOwners;

    for (const owner of targetOwners) {
      const docRef = doc(
        this.firestoreService.getFirestore(),
        `apartments/${apartmentId}/flatOwners/${owner.id}/monthlyExpenses/${monthKey}`
      );

      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : { items: [], totalAmount: 0 };

      const newItem: any = {
        title: exp.title,
        amount: splitAmount,
        isSplit: exp.isSplit,
        createdAt: now // ⏱️ Add timestamp
      };

      if (exp.isSplit) {
        newItem.originalAmount = exp.amount;
      }

      await setDoc(docRef, {
        ...existingData,
        month: monthKey,
        items: [...(existingData['items'] || []), newItem],
        totalAmount: (existingData['totalAmount'] || 0) + splitAmount
      });
    }
  }

  this.pendingExpenses = [];
  await this.loadMonthlyExpenses();
  this.modalService.show('✅ All expenses saved successfully.', 'success');
}

async saveAllExpenses() {
  if (!this.pendingExpenses.length) {
    this.modalService.show('No expenses to save.','error');
    return;
  }

  const apartmentId = this.adminApartmentId!;
  const monthKey = this.getCurrentMonthKey();

  const ownersObservable = this.firestoreService.getFlatOwners(apartmentId);
  const allFlatOwners = await firstValueFrom(ownersObservable);

  for (const expense of this.pendingExpenses) {
    const targetOwners = expense.flatId
      ? allFlatOwners.filter(owner => owner.id === expense.flatId)
      : allFlatOwners;

    for (const owner of targetOwners) {
      const docRef = doc(
        this.firestoreService.getFirestore(),
        `apartments/${apartmentId}/flatOwners/${owner.id}/monthlyExpenses/${monthKey}`
      );

      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : { items: [], totalAmount: 0 };

      const newItem = {
        title: expense.title,
        amount: expense.amount
      };

      await setDoc(docRef, {
        ...existingData,
        month: monthKey,
        items: [...(existingData['items'] || []), newItem],
        totalAmount: (existingData['totalAmount'] || 0) + expense.amount
      });
    }
  }

  this.pendingExpenses = [];
  this.modalService.show('✅ All expenses saved.','success');
  await this.loadMonthlyExpenses();
}
removeExpense(index: number) {
  this.pendingExpenses.splice(index, 1);
}

editExpense(index: number) {
  const e = this.pendingExpenses[index];
  this.newExpenseName = e.title;
  this.expenseAmount = e.amount;
  this.selectedFlatId = e.flatId;
  this.pendingExpenses.splice(index, 1);
}


getFlatNameById(flatId: string | null): string {
  if (!flatId) return 'All Flats';
  const match = this.flatOwners.find(o => o.id === flatId);
  return match ? match.flat : 'Unknown';
}
editPendingExpense(index: number) {
  const exp = this.pendingExpenses[index];
  this.newExpenseName = exp.title;
  this.expenseAmount = exp.amount;
  this.selectedFlatId = exp.flatId;
  this.pendingExpenses.splice(index, 1);
}

removePendingExpense(index: number) {
  this.pendingExpenses.splice(index, 1);
}

// async savePendingExpenses() {
//   for (const exp of this.pendingExpenses) {
//     this.newExpenseName = exp.title;
//     this.expenseAmount = exp.amount;
//     this.selectedFlatId = exp.flatId;
//     await this.addExpense(); // Reuse your actual saving logic
//   }
//   this.pendingExpenses = [];
// }

getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // JS months are 0-indexed
  return `${year}-${month}`;
}


async addExpensedup() {
  const apartmentId = this.adminApartmentId!;
  const month = this.getCurrentMonth(); // format like '2025-05'
  const expenseRef = collection(this.firestoreService.getFirestore(), `apartments/${apartmentId}/expenses`);
  
  const newExpense = {
    title: this.newExpenseName,
    amount: this.expenseAmount,
    createdAt: new Date()
  };

  const docRef = await addDoc(expenseRef, newExpense);

  const flatOwnersSnapshot = await getDocs(collection(this.firestoreService.getFirestore(), `apartments/${apartmentId}/flatOwners`));
  for (const ownerDoc of flatOwnersSnapshot.docs) {
    const ownerId = ownerDoc.id;
    const expenseItem = {
      expenseId: docRef.id,
      title: this.newExpenseName,
      amount: this.expenseAmount,
      paid: false,
      reminded: false
    };

    const monthlyDocRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}/flatOwners/${ownerId}/monthlyExpenses/${month}`);
    const monthlySnap = await getDoc(monthlyDocRef);

    if (monthlySnap.exists()) {
      await updateDoc(monthlyDocRef, {
        items: arrayUnion(expenseItem),
        totalAmount: increment(this.expenseAmount!)
      });
    } else {
      await setDoc(monthlyDocRef, {
        items: [expenseItem],
        totalAmount: this.expenseAmount
      });
    }
  }

  this.newExpenseName = '';
  this.expenseAmount = 0;
  this.loadMonthlyExpenses(); // custom method to refresh the data
}
  getCurrentMonth() {
    throw new Error('Method not implemented.');
  }


async createExpense(apartmentId: string, title: string, amount: number, adminName: string) {
  const flatOwnersRef = collection(this.firestoreService.getFirestore(), `apartments/${apartmentId}/flatOwners`);
  const flatOwnersSnapshot = await getDocs(flatOwnersRef);

  const flatOwnerMap: any = {};
  flatOwnersSnapshot.forEach(owner => {
    const data = owner.data();
    flatOwnerMap[owner.id] = {
      name: data["name"],
      flat: data["flat"],
      paid: false,
      reminded: false
    };
  });

  const expenseRef = doc(collection(this.firestoreService.getFirestore(), `apartments/${apartmentId}/expenses`));
  await setDoc(expenseRef, {
    id: expenseRef.id,
    title,
    amount,
    createdAt: new Date(),
    createdBy: adminName,
    flatOwners: flatOwnerMap
  });

  console.log("Expense added successfully.");
}
async addProvider() {
  if (!this.adminApartmentId || !this.provider?.name || !this.provider?.phone || !this.provider?.category) {
    this.modalService.show('❗ Please fill in all required fields.','error');
    return;
  }

  const db = this.firestoreService.getFirestore();
  const providerRef = doc(collection(db, `apartments/${this.adminApartmentId}/serviceProviders`));

  const provider = {
    id: providerRef.id,
    name: this.provider.name,
    phone: this.provider.phone,
    category: this.provider.category,
    description: this.provider.description || '',
    createdAt: new Date()
  };

  try {
    await setDoc(providerRef, provider);
    this.modalService.show('✅ Service provider added!','success');
    this.loadServiceProviders(this.apartmentId);
    //this.providerData = {}; // reset form
   // this.loadProviders?.(); // reload list if method exists
  } catch (error) {
    console.error('Error adding provider:', error);
    this.modalService.show('Failed to add provider.','error');
  }

  
}

editProvider(sp: any) {
  this.provider = { ...sp };
  this.editingProviderId = sp.id;
}

async updateProvider() {
  if (!this.adminApartmentId || !this.editingProviderId) return;

  const ref = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/serviceProviders/${this.editingProviderId}`);
  await updateDoc(ref, { ...this.provider });
  this.editingProviderId = null;
  this.provider = { name: '', category: '', phone: '', description: '', verified:false };
  this.loadServiceProviders(this.adminApartmentId!);
}

async deleteProvider(id: string) {
  if (!this.adminApartmentId) return;

  const ref = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/serviceProviders/${id}`);
  await deleteDoc(ref);
  this.loadServiceProviders(this.adminApartmentId!);
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
    console.log(this.serviceProviders);
  } catch (error) {
    console.error('Failed to load service providers:', error);
    this.serviceProviders = []; // fallback to empty if it fails
  }
}



// editExpense(index: number) {
//   const expense = this.expenses[index];
//   this.editIndex = index;
//   this.editTitle = expense.title;
//   this.editAmount = expense.amount;
// }

cancelEditExpense() {
  this.editIndex = null;
  this.editTitle = '';
  this.editAmount = null;
}

updateExpense(index: number, expenseId: string) {
  // const expense = this.expenses.find(e => e.id === expenseId);
  // if (expense) {
  //   expense.title = this.editTitle;
  //   expense.amount = this.editAmount;
  //   // Firestore update logic can go here
  // }
  // this.cancelEditExpense();
  // this.groupExpensesByYearAndMonth();
}

deleteExpense(expenseId: string) {
  // this.expenses = this.expenses.filter(e => e.id !== expenseId);
  // this.groupExpensesByYearAndMonth();
}

async sendReminder(apartmentId: string, expenseId: string, ownerId: string) {
  const expenseRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}/expenses/${expenseId}`);
  const expenseSnap = await getDoc(expenseRef);
  const expense = expenseSnap.data();

  if (!expense?.['flatOwners']?.[ownerId]) return;
  expense['flatOwners'][ownerId].reminded = true;

  await updateDoc(expenseRef, {
    flatOwners: expense['flatOwners']
  });

  console.log("Reminder sent to:",expense['flatOwners'][ownerId].name);
}

getOwners(flatOwners: any) {
  return Object.entries(flatOwners || {}).map(([id, data]: any) => ({ id, ...data }));
}

togglePaidStatus(expenseId: string, ownerId: string, currentStatus: boolean) {
  const newStatus = !currentStatus;
  this.firestoreService
    .updateOwnerPaymentStatus(this.adminApartmentId!, expenseId, ownerId, newStatus)
    .then(() => {
      this.loadMonthlyExpenses();
      console.log(`Updated payment status to ${newStatus}`);
    })
    .catch((err) => console.error('Error updating payment status:', err));
}
// toggleExpenseCollapse(index: number) {
//   if (this.expandedExpenseIndex === index) {
//     this.expandedExpenseIndex = null;
//   } else {
//     this.expandedExpenseIndex = index;
//   }
// }

// isExpenseExpanded(index: number): boolean {
//   return this.expandedExpenseIndex === index;
// }

toggleExpenseCollapse(year: number, month: string, index: number): void {
  const key = `${year}-${month}`;
  if (this.expandedExpenses[key] === index) {
    this.expandedExpenses[key] = null;
  } else {
    this.expandedExpenses[key] = index;
  }
}

isExpenseExpanded(year: number, month: string, index: number): boolean {
  const key = `${year}-${month}`;
  const expandedIndex = this.expandedExpenses[key];
  return expandedIndex === index;
}

deleteItem(ownerId: string, itemIndex: number, item: any) {
  const monthKey = this.getCurrentMonthKey();
  const path = `apartments/${this.adminApartmentId}/flatOwners/${ownerId}/monthlyExpenses/${monthKey}`;

  const confirmation = this.modalService.show(
    `Delete '${item.title}' for ₹${item.amount}?`,
    'confirm',
    'Confirm Delete'
  );

  if (confirmation instanceof Promise) {
    confirmation.then((confirmed) => {
      if (!confirmed) return;

      this.firestoreService.getDocument(path).then((docData: any) => {
        const itemsArray: any[] = Array.isArray(docData?.items)
          ? docData.items
          : Object.values(docData?.items || {});
        if (!itemsArray[itemIndex]) return;

        const deletedAmount = itemsArray[itemIndex].amount;
        const updatedItems = itemsArray.filter((_, i) => i !== itemIndex);
        const newTotal = (docData.totalAmount || 0) - deletedAmount;

        this.firestoreService.updateDocument(path, {
          items: updatedItems,
          totalAmount: newTotal
        }).then(() => {
          this.loadMonthlyExpenses(); // Refresh view
        });
      });
    });
  }
}




editItem(ownerId: string, itemIndex: number, item?: any) {
  if (item.title === 'Water Bill') return;
  if (item) {
    // Use UI item directly
    this.editOwnerId = ownerId;
    this.editItemIndex = itemIndex;
    this.editItemTitle = item.title;
    this.editItemAmount = item.amount;
    return;
  }

  // Optional: fallback to Firestore lookup
  const monthKey = this.getCurrentMonthKey();
  const path = `apartments/${this.adminApartmentId}/flatOwners/${ownerId}/monthlyExpenses/${monthKey}`;

  this.firestoreService.getDocument(path).then((docData: any) => {
    const itemFromDb = docData?.items?.[itemIndex];
    if (!itemFromDb) return;

    this.editOwnerId = ownerId;
    this.editItemIndex = itemIndex;
    this.editItemTitle = itemFromDb.title;
    this.editItemAmount = itemFromDb.amount;
    this.cdr.detectChanges();
  });
}


saveItemEdit() {
  if (!this.editOwnerId || !this.editItemTitle) return;

  const monthKey = this.getCurrentMonthKey();
  const path = `apartments/${this.adminApartmentId}/flatOwners/${this.editOwnerId}/monthlyExpenses/${monthKey}`;

  this.firestoreService.getDocument(path).then((docData: any) => {
    const itemsArray: any[] = Array.isArray(docData?.items)
      ? [...docData.items]
      : Object.values(docData?.items || {});

    const existingIndex = itemsArray.findIndex(item =>
      item.title === this.editItemTitle
    );

    let oldAmount = 0;

    if (existingIndex !== -1) {
      oldAmount = itemsArray[existingIndex].amount;
      itemsArray[existingIndex] = {
        title: this.editItemTitle,
        amount: this.editItemAmount
      };
    } else {
      // New entry fallback
      itemsArray.push({
        title: this.editItemTitle,
        amount: this.editItemAmount
      });
    }

    const currentTotal = docData.totalAmount || 0;
    const newTotal = currentTotal - oldAmount + this.editItemAmount;

    this.firestoreService.updateDocument(path, {
      items: itemsArray,
      totalAmount: newTotal
    }).then(() => {
      this.clearEditState();
      this.loadMonthlyExpenses(); // Refresh UI
    });
  });
}



clearEditState() {
  this.editOwnerId = null;
  this.editItemIndex = null;
  this.editItemTitle = '';
  this.editItemAmount = 0;
}

goToUpgrade() {
  this.router.navigate(['/upgrade']);
}


toNumber(value: string): number {
  return Number(value);
}

/** settings */

async loadCurrentWaterBillSettings(): Promise<void> {
  const settingsCollectionRef = collection(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/waterBillSettings`);
  try {
    // Query for the latest settings document by effective month (descending order)
    const q = query(settingsCollectionRef, orderBy('effectiveFromMonth', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const latestSettings = querySnapshot.docs[0].data() as WaterBillSettings;
      this.waterTariffPerLiter = latestSettings.waterTariffPerLiter;
      this.waterUsageThreshold = latestSettings.waterUsageThreshold;
      this.extraWaterCharge = latestSettings.extraWaterCharge;
      this.settingsApplyMonth = latestSettings.effectiveFromMonth; // Set UI to last applied month
      console.log('Loaded current water bill settings:', latestSettings);
    } else {
      console.log('No existing water bill settings found. Using default UI values.');
    }
  } catch (error) {
    console.error('Error loading current water bill settings:', error);
  }
}

async saveWaterBillSettings(): Promise<void> {
  // Validate selected month for application
  if (!this.settingsApplyMonth) {
    this.statusMessage = 'Please select a month for these settings to apply from.';
    console.warn(this.statusMessage);
    return;
  }
  const monthFormatRegex = /^\d{4}-\d{2}$/;
  if (!monthFormatRegex.test(this.settingsApplyMonth)) {
    this.statusMessage = 'Invalid month format for settings application. Please use YYYY-MM.';
    console.warn(this.statusMessage);
    return;
  }

  const settingsDocRef = doc(
    this.firestoreService.getFirestore(),
    `apartments/${this.adminApartmentId}/waterBillSettings/${this.settingsApplyMonth}`
  );

  const newSettings: WaterBillSettings = {
    waterTariffPerLiter: this.waterTariffPerLiter,
    waterUsageThreshold: this.waterUsageThreshold,
    extraWaterCharge: this.extraWaterCharge,
    effectiveFromMonth: this.settingsApplyMonth,
    savedAt: new Date().toISOString()
  };

  try {
    await setDoc(settingsDocRef, newSettings);
    this.statusMessage = `Water bill settings saved successfully, effective from ${this.settingsApplyMonth}.`;
    console.log('Water bill settings saved:', newSettings);
  } catch (error) {
    console.error('Error saving water bill settings:', error);
    this.statusMessage = 'Failed to save water bill settings. Please try again.';
  }
}

async getWaterBillSettingsForMonth(month: string): Promise<WaterBillSettings | null> {
  const settingsCollectionRef = collection( this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/waterBillSettings`);
  
  // Query for settings documents that are effective *on or before* the given month, ordered descending
  const q = query(
    settingsCollectionRef,
    where('effectiveFromMonth', '<=', month), // find documents whose effectiveFromMonth is <= the requested month
    orderBy('effectiveFromMonth', 'desc'),    // get the latest one
    limit(1)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as WaterBillSettings;
    } else {
      console.warn(`No water bill settings found for month ${month} or earlier. Using default/fallback.`);
      // Return a default or null if no settings are found
      return {
        waterTariffPerLiter: 0, // Fallback defaults
        waterUsageThreshold: 0,
        extraWaterCharge: 0,
        effectiveFromMonth: '1970-01' // Indicate no specific setting was found
      };
    }
  } catch (error) {
    console.error(`Error fetching water bill settings for month ${month}:`, error);
    return null; // Handle error appropriately
  }
}

compareMonths(month1: string, month2: string): number {
  const [year1, monthNum1] = month1.split('-').map(Number);
  const [year2, monthNum2] = month2.split('-').map(Number);

  if (year1 < year2) return -1;
  if (year1 > year2) return 1;
  // Years are equal, compare months
  if (monthNum1 < monthNum2) return -1;
  if (monthNum1 > monthNum2) return 1;
  return 0; // Months are equal
}

async applySettingsToAll() {
  if (!this.settingsApplyMonth) {
    console.warn('Please select a month to apply settings for.');
    return;
  }

  const settingsRef = doc(
    this.firestoreService.getFirestore(),
    `apartments/${this.adminApartmentId}/settings/waterBilling`
  );

  const fieldPath = this.settingsApplyMonth;

  const updatePayload = {
    [fieldPath]: {
      waterTariffPerLiter: this.waterTariffPerLiter,
      waterUsageThreshold: this.waterUsageThreshold,
      extraWaterCharge: this.extraWaterCharge,
    }
  };

  try {
    await setDoc(settingsRef, updatePayload, { merge: true });
    this.modalService.show(`Water billing settings saved for month ${this.settingsApplyMonth}`,'info');
    this.loadWaterBillingSettings();
  } catch (error) {
    this.modalService.show('Error saving settings:','error');
    console.error('Error saving settings:', error);
  }
}

loadWaterBillingSettings() {
  const ref = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/settings/waterBilling`);
  getDoc(ref).then(snap => {
    if (snap.exists()) {
      this.waterBillingSettings = snap.data();

      // Convert object to array of [month, settings] sorted by month
      this.waterBillingEntries = Object.entries(this.waterBillingSettings)
        .sort(([a], [b]) => a.localeCompare(b)); // Ensures chronological order like '2025-06', '2025-07'
    } else {
      this.waterBillingSettings = {};
      this.waterBillingEntries = [];
    }
  });
}

edit(month: string) {
  this.editingMonth = month;
  this.editedValues = { ...this.waterBillingSettings[month] };
 
}

cancelEdit1() {
  this.editingMonth = null;
  this.editedValues = {};
}

async saveEditedMonth() {
  if (!this.editingMonth) return;

  const ref = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/settings/waterBilling`);
  const updatePayload = {
    [this.editingMonth]: { ...this.editedValues }
  };

  try {
    await updateDoc(ref, updatePayload);
    this.waterBillingSettings[this.editingMonth] = { ...this.editedValues };
    this.cancelEdit1();
    this.loadWaterBillingSettings();
  } catch (err) {
    console.error('Failed to update:', err);
  }
}

delete(month: string) {
  if (!this.modalService.show(`Delete water billing settings for ${month}?`,'confirm')) return;

  const ref = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/settings/waterBilling`);
  updateDoc(ref, {
    [month]: deleteField()
  }).then(() => {
    delete this.waterBillingSettings[month];
    this.loadWaterBillingSettings();
  }).catch(error => {
    console.error("Failed to delete month:", error);
  });
}

// get waterBillingEntries(): [string, { waterTariffPerLiter: number; waterUsageThreshold: number; extraWaterCharge: number }][] {
//   return Object.entries(this.waterBillingSettings || {}) as [string, {
//     waterTariffPerLiter: number;
//     waterUsageThreshold: number;
//     extraWaterCharge: number;
//   }][];
// }

/** water bill settings */
async saveCurrentMonthSettings() {
  if (!this.settingsApplyMonth) {
    this.modalService.show('Please select a month first.', 'error');
    return;
  }

  const settingsRef = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/settings/waterBilling`);
  const settingsSnap = await getDoc(settingsRef);
  const data = settingsSnap.exists() ? settingsSnap.data() : {};

  data[this.settingsApplyMonth] = {
    waterTariffPerLiter: this.waterTariffPerLiter,
    waterUsageThreshold: this.waterUsageThreshold,
    extraWaterCharge: this.extraWaterCharge
  };

  await setDoc(settingsRef, data);
  this.loadWaterBillingSettings();
  this.modalService.show('Saved for selected month.', 'success');
}

async applyToAllRemainingMonths() {
  if (!this.settingsApplyMonth) {
    this.modalService.show('Please select a starting month.', 'error');
    return;
  }
  const settingsRef = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/settings/waterBilling`);
  const settingsSnap = await getDoc(settingsRef);
  const data = settingsSnap.exists() ? settingsSnap.data() : {};

  const from = new Date(`${this.settingsApplyMonth}-01`);
  for (let i = 0; i < 12; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const key = d.toISOString().slice(0, 7);
    data[key] = {
      waterTariffPerLiter: this.waterTariffPerLiter,
      waterUsageThreshold: this.waterUsageThreshold,
      extraWaterCharge: this.extraWaterCharge
    };
  }

  await setDoc(settingsRef, data);
  this.loadWaterBillingSettings();
  this.modalService.show('Applied to all remaining months.', 'success');
}

async useAsYearlyDefault() {
  const settingsRef = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/settings/waterBilling`);
  const settingsSnap = await getDoc(settingsRef);
  const data = settingsSnap.exists() ? settingsSnap.data() : {};

  data['default'] = {
    waterTariffPerLiter: this.waterTariffPerLiter,
    waterUsageThreshold: this.waterUsageThreshold,
    extraWaterCharge: this.extraWaterCharge
  };

  await setDoc(settingsRef, data);
  this.loadWaterBillingSettings();
  this.modalService.show('Set as default yearly setting.', 'success');
}

async copySettings(fromMonth: string, toMonth: string) {
  if (!fromMonth || !toMonth) {
    this.modalService.show('Please select both months.', 'error');
    return;
  }
  const settingsRef = doc(this.firestoreService.getFirestore(), `apartments/${this.adminApartmentId}/settings/waterBilling`);
  const settingsSnap = await getDoc(settingsRef);
  const data = settingsSnap.exists() ? settingsSnap.data() : {};

  const source = data[fromMonth];
  if (!source) {
    this.modalService.show('Source month not found.', 'error');
    return;
  }

  data[toMonth] = { ...source };
  await setDoc(settingsRef, data);
  this.modalService.show('Copied successfully.', 'success');
}
async loadAllSavedWaterBillingData() {
  const firestore = this.firestoreService.getFirestore();
  this.waterBillData = {};  // clear old data

  if(this.availableFlats.length == 0){
    await this.loadAvailableFlats();
  }
  for (const flat of this.availableFlats) {
    const expensesRef = collection(
      firestore,
      `apartments/${this.adminApartmentId}/flatOwners/${flat.id}/monthlyExpenses`
    );

    const snapshots = await getDocs(expensesRef);
    
    snapshots.forEach(docSnap => {
      const data = docSnap.data();
      const month = docSnap.id;

      // Only process records that have meter info
      if ('currentReading' in data || 'previousReading' in data) {
        if (!this.waterBillData[month]) {
          this.waterBillData[month] = [];
        }
        this.waterBillData[month].push({
          ...data,
          flatNo: flat.flat || flat.name || flat.id,
          flatId: flat.id,
        });
      }
    });
  }

  // Update monthsInView (used for looping in UI)
  this.monthsInView = Object.keys(this.waterBillData).sort().reverse();
}

get visibleWaterBillMonths(): string[] {
  return Object.keys(this.waterBillData).filter(
    month => Array.isArray(this.waterBillData[month]) && this.waterBillData[month].length > 0
  );
}
addOption() {
  this.newPoll.options.push('');
}

async createPoll() {
  const title = this.newPoll.title.trim();
  const description = this.newPoll.description?.trim() || '';
  const options = this.newPoll.options.map(o => o.trim()).filter(o => o);


  if (!title) {
    this.modalService.show('Poll title is required.','warning');
    return;
  }


  if (options.length < 2) {
    this.modalService.show('At least 2 options are required.','error');
    return;
  }


  const uniqueOptions = new Set(options);
  if (uniqueOptions.size !== options.length) {
    this.modalService.show('Poll options must be unique.','warning');
    return;
  }

  // ✅ Proceed if valid
  const poll = {
    title,
    description,
    options,
    createdAt: Timestamp.now(),
    createdBy: 'admin',
    isActive: true,
    votes: {}
  };

  const pollsRef = collection(this.firestore, `apartments/${this.adminApartmentId}/polls`);
  await addDoc(pollsRef, poll);

  this.newPoll = { title: '', description: '', options: [''] };
  await this.ngOnInit(); // or just refresh poll list
}

async deletePoll(poll: any) {
  const confirmDelete = await this.modalService.show(
    `Are you sure you want to delete the poll: "${poll.title}"?`,
    'confirm'
  );

  if (!confirmDelete) return;

  const pollRef = doc(this.firestore, `apartments/${this.adminApartmentId}/polls/${poll.id}`);
  await deleteDoc(pollRef);

  // Remove locally
  this.polls = this.polls.filter(p => p.id !== poll.id);
}

getVotesCount(poll: any, option: string): string {
  const count = Object.values(poll.votes || {})
    .filter(v => v === option).length;
  return `— ${count} vote${count !== 1 ? 's' : ''}`;
}

async closePoll(poll: any) {
  const confirmClose = await this.modalService.show(`Do you want to close the poll: "${poll.title}"?`, 'confirm');
  if (!confirmClose) return;

  const pollRef = doc(this.firestore, `apartments/${this.adminApartmentId}/polls/${poll.id}`);
  await updateDoc(pollRef, { isActive: false });

  poll.isActive = false; // Update locally
}

get hasUnseenRequests(): boolean {
  if (!this.requestsSeenAt) return false;

  return this.filteredRequests?.some(req => {
    const created = req.timestamp?.toDate?.();
    return created && created > this.requestsSeenAt!;
  });
}
onMaintenanceToggle(event: Event) {
  const open = (event.target as HTMLDetailsElement).open;
  if (open) {
    this.requestsSeenAt = new Date();
    localStorage.setItem('requestsSeenAt', this.requestsSeenAt.toISOString());
  }
}
get hasUnseenAnnouncements(): boolean {
  if (!this.announcementsSeenAt) return false;

  return this.announcements?.some(a => {
    const posted = a.postedAt?.toDate?.();
    return posted && posted > this.announcementsSeenAt!;
  });
}
onAnnouncementsToggle(event: Event) {
  const details = event.target as HTMLDetailsElement;
  if (details.open) {
    this.announcementsSeenAt = new Date();
    localStorage.setItem('announcementsSeenAt', this.announcementsSeenAt.toISOString());
  }
}
get hasUnseenPolls(): boolean {
  if (!this.pollsSeenAt) return false;

  return this.polls?.some(poll => {
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
get hasUnseenMarketplaceItems(): boolean {
  if (!this.marketplaceSeenAt || !this.marketplaceItems) return false;

  return this.marketplaceItems.some(item => {
    const created = item.createdAt?.toDate?.();
    return created && created > this.marketplaceSeenAt!;
  });
}
onMarketplaceToggle(event: Event) {
  const details = event.target as HTMLDetailsElement;
  if (details.open) {
    this.marketplaceSeenAt = new Date();
    localStorage.setItem('marketplaceSeenAt', this.marketplaceSeenAt.toISOString());
  }
}
onMarketplaceItemsLoaded(items: any[]) {
  this.marketplaceItems = items;
}
loadMarketplaceItems() {
  this.firestoreService.getMarketplaceItems(this.adminApartmentId!).subscribe(items => {
    this.loadedItems = items;
    this.itemsLoaded.emit(items);
  });
}
loadSecurityUsers() {
  const firestore = this.firestoreService.getFirestore();
  const apartmentId = this.adminApartmentId;

  const secRef = collection(firestore, `apartments/${apartmentId}/securityUsers`);
  const q = query(secRef);

  onSnapshot(q, snapshot => {
    this.securityUsers = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  });
  console.log(this.securityUsers );
}

async addSecurityUser() {
  if (!this.newSecurity.name || !this.newSecurity.phone) {
    this.modalService.show('⚠️ Name and Phone are required for security user.', 'warning');
    return;
  }

  try {
    const firestore = this.firestoreService.getFirestore();
    const apartmentId = this.adminApartmentId ?? undefined;
    const apartmentName = this.apartmentName ?? undefined;

    const secRef = collection(firestore, `apartments/${apartmentId}/securityUsers`);

    const newDocRef = await addDoc(secRef, {
      name: this.newSecurity.name,
      phoneNumber: this.newSecurity.phone,
      // email: this.newSecurity.email || '',
      createdAt: new Date().toISOString()
    });

    // ✅ Update userIndex with safe values
    await this.firestoreService.updateUserIndex(
      this.newSecurity.phone,
      'security',
      'security',
      apartmentId,
      undefined, // flatOwnerId
      apartmentName,
      undefined, // flat
      undefined,
      this.newSecurity.name
    );

    this.modalService.show('✅ Security user added successfully!', 'success');
    this.newSecurity = { name: '', phone: '', email: '' };

  } catch (error) {
    console.error('Error adding security user:', error);
    this.modalService.show('❌ Failed to add security user.', 'error');
  }
}



removeSecurityUser(id: string) {
  const firestore = this.firestoreService.getFirestore();
  const apartmentId = this.adminApartmentId;

  const secDoc = doc(firestore, `apartments/${apartmentId}/securityUsers/${id}`);
  deleteDoc(secDoc);
}
getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

getFirestore() {
  return this.firestore; 
}

}



