import { ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import {
  trigger,
  transition,
  style,
  animate
} from '@angular/animations';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth.service';
import { FirestoreService } from './services/services/firestore.service';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { MarketplaceComponent } from './marketplace/marketplace/marketplace.component';
import { Admin } from './services/services/models/models';
import { LandingComponent } from './landing/landing/landing.component';
import { MobileLoginComponent } from './mobile-login/mobile-login/mobile-login.component';
import { LoginComponent } from './auth/login/login.component';
import { Modal } from 'bootstrap';
declare var bootstrap: any;

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  imports:[CommonModule,RouterModule,MobileLoginComponent],
  })
 
export class AppComponent {
  userName: string = '';  
  showMenu: boolean = false;
  apartmentName: string = '';
  showUpgradeModal = false;
  phoneNumber: string | null = null;
  adminName: string | null = null;
  admin: Admin | null = null;
  otpVerified = false;
  isMenuOpen: boolean = false;
  showProfileModal = false;
  isMobile = false;
 
  @ViewChild('profileModal') profileModalRef!: ElementRef;

  constructor(public router: Router,public authService: AuthService,private firestoreService: FirestoreService,private cdr: ChangeDetectorRef) {
    this.authService.startIdleMonitor();
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        window.scrollTo(0, 0);
      }
    });
  }

  ngOnInit(): void {
    this.checkScreenSize(); // Check screen size initially
    window.addEventListener('resize', this.checkScreenSize.bind(this)); // Dynamically update
    // Redirect mobile users from /landing to /login
    if (this.isMobile && this.router.url === '/landing') {
      this.router.navigate(['/login']);
      return;
    }
  
    // Load admin from session (if exists) and re-emit
    // const existingAdmin = this.authService.getAdminDetails();
    // console.log('Adminfgf Name:', existingAdmin);
    // if (existingAdmin) {
    //   this.authService.setAdminDetails(existingAdmin);
    // }
    this.authService.otpVerified$.subscribe(val => this.otpVerified = val);
    this.authService.admin$.subscribe(admin => this.admin = admin);
    // Subscribe to admin stream
    this.authService.admin$.subscribe((admin: Admin | null) => {
      this.admin = admin;
      if (this.admin) {
        console.log('Admin Name:', this.admin);
        console.log('Phone:', this.admin.phone);
      } else {
        console.log('Session expired or not logged in');
      }
    });
  
    // Subscribe to OTP verification status
    this.authService.otpVerified$.subscribe(status => {
      this.otpVerified = status;
    });
  
    // Firebase authentication check
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User is signed in:', user.phoneNumber);
      } else {
        console.log('No user signed in');
      }
    });
  }

  @HostListener('window:resize')
  checkScreenSize() {
    this.isMobile = window.innerWidth <= 768;
  }

  async getUserDetails() {
    const user = getAuth().currentUser; 
    console.log("user - >",user);
    if (user) {
      try {
        const userDocRef = doc(this.firestoreService.getFirestore(), `users/${user.uid}`);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          this.userName = userData?.['name'] || 'User';
          this.apartmentName = userData?.['apartmentName'] || 'No Apartment';
          console.log("userData - >", userData);

          // Optionally store in localStorage to persist state across refreshes
          localStorage.setItem('userName', this.userName);
          localStorage.setItem('apartmentName', this.apartmentName);
        } else {
          console.log("No such user document!");
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      }
    } else {
      console.log("No user logged in.");
    }
  }
  // Toggle the dropdown menu when clicking the user icon
  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.showMenu = !this.showMenu;
  }

  @HostListener('document:click')
  closeDropdown() {
    this.showMenu = false;
  }

  getInitials(name: string): string {
    if (!name.trim()) return '';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  get role(): string | null {
    return this.admin?.role || null;
  }
  

  // Function to logout user and redirect to login page
  logout() {
    sessionStorage.clear();
    this.closeProfileModal();
    this.otpVerified = false;
    this.showUpgradeModal = false;
    this.authService.clearAdminDetails();
    localStorage.clear();  // Clear user data from localStorage
    this.router.navigate(['/login']);  // Navigate to login page
  }

  // Function to check if the dropdown menu should be shown
  shouldShowMenu(): boolean {
    return this.router.url !== '/login';  // Hide menu on login page
  }
  openUpgradeModal() {
    this.showUpgradeModal = true;
  }
  
  closeUpgradeModal() {
    this.showUpgradeModal = false;
  }
  
  proceedToPayment() {
    this.closeUpgradeModal();
    // Logic to integrate Razorpay, Stripe, UPI, etc.
  }

  // openProfileModal() {
  //   console.log('Profile modal triggered ✅');
  //   this.showProfileModal = true;
  //   this.cdr.detectChanges(); 
  //   this.showMenu = false;
  // }
  openProfileModal() {
    const modal = new bootstrap.Modal(this.profileModalRef.nativeElement);
    modal.show();
  }

  
  closeProfileModal() {
    const modalInstance = bootstrap.Modal.getInstance(this.profileModalRef.nativeElement);
    modalInstance?.hide();
  }
}
