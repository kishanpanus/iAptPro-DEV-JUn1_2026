import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth.service';
import { FirestoreService } from '../../services/services/firestore.service';
import { addDoc, collection, doc, Firestore, getDoc, getDocs, getFirestore, query, Timestamp, where } from 'firebase/firestore';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Filter } from 'bad-words'; // ✅ CORRECT
import { ConfirmationResult, getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { ModalService } from '../../services/services/model.service';
import { Admin, ExtendedRole } from '../../services/services/models/models';
import { FingerprintAIO } from '@awesome-cordova-plugins/fingerprint-aio/ngx';
import { OtpService } from '../../otp.service';


// interface UserData {
//   role: string;
//   apartment: string | null;
// }

interface SuperAdminUser {
  role: 'superadmin';
}

interface AdminUser {
  role: 'admin';
  apartment: string;
}

interface ResidentUser {
  role: 'resident';
  apartment: string;
  flat: string;
  name: string;
  phoneNumber: string;
}
interface SecurityUser {
  role: 'security';
  apartment: string;
  name: string;
  phoneNumber: string;
}


export type UserData = SuperAdminUser | AdminUser | ResidentUser | SecurityUser;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  apartmentName: string = '';
  phoneNumber: string = '';
  otpCode: string = '';
  generatedOtp: string = '';
  otpSent: boolean = false;
  //currentUser: { role: string; apartment: string | null } | null = null;
  currentUser: UserData | null = null;
  allApartments: string[] = ['ABC', 'SkyView'];
  availableApartments: string[] = [];
  showApartmentDropdown: boolean = false;
  apartmentId: string | null = null;
  role: string | null = null;
  showContactForm = false;
  interestName = '';
  interestPhone = '';
  interestMessage = '';
  interestSubmitted = false;
  userNotFound: boolean = false;
  blnSendOTP: boolean = false;
  confirmationResult!: ConfirmationResult; 
  isAdminApproved: boolean = true;
  canUseBiometric = false;
  isBlockingMessageShown = false;
  otpVerified = false;
  pendingAdminData: Admin | null = null;
  pinSetInFirestore: boolean = false;
  showOTPSection = false;
  pinErrorCount = 0;
  selectedLoginTab: 'face' | 'pin' | 'otp' = 'face';
  selectedMethod: 'face' | 'pin' | 'otp' | null = null;
  loginReady = false;
  isPhoneValid: boolean = false;
  enteredPin: string = '';
  phoneNumberNotFound: boolean = false;
  otp: string = '';
  sessionId: string = '';
sendingOtp = false;
verifyingOtp = false;

  constructor(private router: Router, private authService: AuthService, private firestoreService: FirestoreService,private snackBar: MatSnackBar,
    private modalService: ModalService, private faio: FingerprintAIO,private otpService: OtpService) {}
 
  async ngOnInit() {
    localStorage.clear();
    const biometricEnabled = localStorage.getItem('biometricLoginEnabled');
    const remembered = localStorage.getItem('apt3m_remembered');
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
  
    if (!user) return;
    await this.checkPinStatus();
    const pinExists = await this.checkPinInFirestore();
    localStorage.setItem('pinSet', pinExists ? 'true' : 'false');
  
    if (!pinExists) {
      this.router.navigate(['/set-pin']);
      return;
    }
  
    if (remembered === 'true') {
      this.router.navigate(['/enter-pin']);
      return;
    }
  
    if (biometricEnabled === 'true') {
      this.authService.startIdleMonitor();
      switch ((user.role || '').toLowerCase()) {
        case 'admin': this.router.navigate(['/admin']); break;
        case 'superadmin': this.router.navigate(['/superadmin']); break;
        case 'security': this.router.navigate(['/security']); break;
        default: this.router.navigate(['/dashboard']); break;
      }
    }
  }

  async onPhoneInputChange() {
    this.isPhoneValid = this.phoneNumber.trim().length === 10;
    if (!this.isPhoneValid) {
      this.selectedMethod = null; 
    } else {
      await this.onPhoneNumberChange();
    }
  }

  onPhoneNumberEntered() {
    if (this.phoneNumber.length === 10) {
      this.loginReady = true;
    } else {
      this.loginReady = false;
      this.selectedMethod = null;
    }
  }
  
  selectMethod(method: 'face' | 'pin' | 'otp') {
    if (this.userNotFound) {
      this.selectedMethod = null;
      return;
    }
    this.selectedMethod = method;
    this.otpSent = false;
  }
  

  private async checkPinStatus() {
    const apartmentId = this.apartmentId;
    const userId = localStorage.getItem('userId');
    const deviceId = localStorage.getItem('apt3m_deviceId') || 'default';
    const userType = this.mapRoleToUserType(this.role || '');
  
    if (apartmentId && userId) {
      const pinDoc = await this.firestoreService.getTrustedDeviceInfo(apartmentId, userType, userId, deviceId);
      this.pinSetInFirestore = !!pinDoc?.pin;
    }
  }
  
  async loginWithPIN() {
    const userStr = localStorage.getItem('user');
    const enteredPin = this.enteredPin?.trim();
  
    if (!enteredPin || enteredPin.length !== 4) return;
  
    const apartmentId = this.apartmentId;
    const userId = localStorage.getItem('userId');
    const deviceId = localStorage.getItem('apt3m_deviceId') || 'default';
    const userType = this.mapRoleToUserType(this.role || '');
  
    const pinDoc = await this.firestoreService.getTrustedDeviceInfo( this.role === 'superadmin' ? null : apartmentId, userType, userId!, deviceId);
  
    if (pinDoc?.pin === enteredPin) {
      localStorage.setItem('otpVerified', 'true');
      this.authService.setOtpVerified(true); 
      localStorage.setItem('userId', userId!);
      this.authService.setOtpVerified(true);
      this.authService.setAdminDetails(this.pendingAdminData!);
      this.authService.startIdleMonitor();
      this.navigateToRoleDashboard(this.role!);
    } else {
      this.pinErrorCount++;
      if (this.pinErrorCount >= 3) {
        this.modalService.show('Too many wrong attempts. Please login with OTP.', 'warning');
        this.showOTPSection = true;
      } else {
        this.modalService.show(`Incorrect PIN (${this.pinErrorCount}/3).`, 'error');
      }
    }
  }

  navigateToRoleDashboard(role: string) {
    switch (role.toLowerCase()) {
      case 'admin': this.router.navigate(['/admin']); break;
      case 'superadmin': this.router.navigate(['/superadmin']); break;
      case 'security': this.router.navigate(['/security']); break;
      default: this.router.navigate(['/dashboard']); break;
    }
  }
  
  async forgotPin() {
    const apartmentId = this.apartmentId;
    const userId = localStorage.getItem('userId');
    const deviceId = localStorage.getItem('apt3m_deviceId') || 'default';
    const userType = this.mapRoleToUserType(this.role || '');
  
    if (!apartmentId || !userId) {
      this.modalService.show('Missing user info. Please re-enter your phone number.', 'warning');
      return;
    }
  
    try {
      // ✅ Use FirestoreService to clear the PIN
      await this.firestoreService.clearPin(apartmentId, userType, userId, deviceId);
  
      localStorage.setItem('pinSet', 'false');
  
      // Continue to OTP login flow
      this.selectedMethod = 'otp';
      this.showOTPSection = true;
      this.sendOTP();
  
    } catch (error) {
      console.error('Error clearing PIN:', error);
    }
  }
  
  
  private async checkPinInFirestore(): Promise<boolean> {
    const role = localStorage.getItem('userRole');
    const userId = localStorage.getItem('userId');
    const deviceId = localStorage.getItem('apt3m_deviceId') || 'default';
  
    // ✅ Special handling for superadmin
    if (role === 'superadmin') {
      const path = `superadmin/${userId}/trustedDevices/${deviceId}`; 
      const docRef = doc(this.firestoreService.getFirestore(), path);
      const snap = await getDoc(docRef);
      const data = snap.data();
  
      console.log('🔥 Superadmin PIN check at:', path, '=>', data);
      return snap.exists() && !!data?.['pin'];
    }
  
    // ✅ For all other roles
    const apartmentId = localStorage.getItem('apartmentId');
    const userType = localStorage.getItem('userType') as 'admins' | 'flatOwners' | 'securityUsers' | null;
  
    if (!apartmentId || !userType || !userId) {
      console.warn('Missing context', { apartmentId, userType, userId });
      return false;
    }
  
    const path = `apartments/${apartmentId}/${userType}/${userId}/trustedDevices/${deviceId}`;
    const docRef = doc(this.firestoreService.getFirestore(), path);
    const snap = await getDoc(docRef);
    const data = snap.data();
  
    console.log('🔥 PIN check at:', path, '=>', data);
    return snap.exists() && !!data?.['pin'];
  }
  
  
  
  
  async biometricLogin() {
    const biometricEnabled = localStorage.getItem('biometricLoginEnabled');
    if (biometricEnabled !== 'true') {
      this.modalService.show('Biometric login is not enabled.', 'warning');
      return;
    }
  
    try {
      const result = await this.faio.show({
        title: 'Authenticate',
        subtitle: '',
        description: 'Scan your fingerprint or face to login',
        fallbackButtonTitle: 'Cancel',
        disableBackup: true
      });
  
      this.loginAfterBiometric();

    } catch (err) {
      console.error('Biometric login failed', err);
      this.modalService.show('Biometric authentication failed.', 'error');
    }
  }
  
  private loginAfterBiometric() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const apartmentName = localStorage.getItem('apartmentName') || '';
  
    const adminData: Admin = {
      name: user.name || '',
      phone: user.phone || '',
      role: user.role,
      apartmentName: apartmentName,
      approvalDate: '',
      approvalStatus: '',
      approved: true,
      block: '',
      creationDate: '',
      email: '',
      flatNumber: '',
      flatOwnerId: localStorage.getItem('userId') || '',
      isActive: true
    };
  
    this.authService.setAdminDetails(adminData);
    this.authService.setOtpVerified(true);
    this.authService.startIdleMonitor();
  
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
      default:
        this.router.navigate(['/dashboard']);
        break;
    }
  }
  
  

  async onPhoneNumberChange(): Promise<boolean> {
    this.isAdminApproved =  true;
    const phone = this.phoneNumber.trim();
    this.phoneNumberNotFound = false;
    if (!phone || phone.length !== 10) return false;
  
    const firestore = this.firestoreService.getFirestore();
    const result = await this.firestoreService.getUserByPhoneNumber(phone);
  
    if (!result) {
      this.userNotFound = true;
      this.phoneNumberNotFound = true;
      this.blnSendOTP = true;
      return false;
    }
  
    const { userData, role, apartmentId, flatOwnerId } = result;
  
    this.role = role;
    this.apartmentId = apartmentId || null;
    this.apartmentName = userData.apartmentName || '';
    const userId = flatOwnerId || '';
    const userType = this.mapRoleToUserType(role);
  
    const apartmentData = await this.firestoreService.getApartmentById(this.apartmentId!);
    const adminData = userData;
  
    if (apartmentData?.locked) {
      this.isAdminApproved = false;
      this.modalService.show(
        '🚫 Access denied. Your apartment is locked by SuperAdmin.\nReason: ' + (apartmentData.lockedReason || 'No reason specified.'),
        'warning'
      );
      return false;
    }
  
    if (adminData?.adminRole !== 'superadmin' && !adminData?.approved) {
      this.isAdminApproved = false;
      this.modalService.show(
        '⚠️ Your registration is pending SuperAdmin approval.',
        'warning'
      );
      return false;
    }
  
    this.pendingAdminData = {
      name: userData.adminName?.trim() || userData.name?.trim() || 'Admin',
      role,
      apartmentName: this.apartmentName,
      approvalDate: userData.approvalDate || '',
      approvalStatus: userData.approvalStatus || '',
      approved: userData.approved ?? true,
      block: userData.block || '',
      creationDate: userData.creationDate || new Date().toISOString(),
      email: userData.email || '',
      flatNumber: userData.flatNumber || userData.flat || '',
      flatOwnerId: flatOwnerId || '',
      phone: userData.phone || userData.phoneNumber || phone,
      isActive: userData.isActive ?? true,
      userId: userId
    };
  
    this.currentUser = {
      role,
      apartment: this.apartmentId,
      flat: userData.flatNumber || userData.flat || '',
      name: userData.name,
      phoneNumber: userData.phone || userData.phoneNumber
    } as any;
  
    localStorage.setItem('userId', userId);
    localStorage.setItem('userType', userType);
    localStorage.setItem('apartmentId', this.apartmentId || '');
    localStorage.setItem('user', JSON.stringify(this.currentUser));
  
    await this.checkPinStatus();
    this.blnSendOTP = true;
    this.userNotFound = false;
  
    return true; // ✅ default success return
  }
  
  

  //remove this code
  // async onPhoneNumberChange11() {
  //   const phone = this.phoneNumber.trim();
  //   this.userNotFound = false;
  //   this.isAdminApproved = true;
    
  //   if (!phone || phone.length !== 10) return;
  
  //   const firestore = this.firestoreService.getFirestore();
  
  //   // 🔍 1. Check if user is an Admin
  //   const apartmentData = await this.checkAdminByPhone(firestore, phone);
  //   if (apartmentData) {
  //     if (this.isTrialExpired(apartmentData)) {
  //       this.isBlockingMessageShown = true;
  //       this.modalService.show(
  //         '❌ Trial expired. Please upgrade your plan to log in',
  //         'warning',
  //         '',
  //         () => { this.isBlockingMessageShown = false; }
  //       );
  //       return;
  //     }
  //     return;
  //   }
  
  //   // 🔍 2. Check if user is a Flat Owner
  //   const isFlatOwner = await this.checkFlatOwnerByPhone(firestore, phone);
  //   if (isFlatOwner) {
  //     await this.validateApartmentAccess(firestore);
  //     return;
  //   }
  
  //   // 🔍 3. Check if user is a Spouse
  //   const isSpouse = await this.checkSpouseByPhone(firestore, phone);
  //   if (isSpouse) {
  //     await this.validateApartmentAccess(firestore);
  //     return;
  //   }
  
  //   // 🔍 4. Check if user is a SuperAdmin
  //   const isSuperAdmin = await this.checkSuperAdminByPhone(firestore, phone);
  //   if (isSuperAdmin) return;

  //   const isSecurityUser = await this.checkSecurityByPhone(firestore, phone);
  //   if (isSecurityUser) return;

  
  //   // ❌ No user match
  //   if (!this.isBlockingMessageShown) {
  //     this.userNotFound = true;
  //   }
  //   this.blnSendOTP = true;
  //   console.warn('No user found with that phone number.');
  // }
  
  

  private async validateApartmentAccess(firestore: Firestore) {
    const apartmentId = this.apartmentId;
    const apartmentSnap = await getDoc(doc(firestore, `apartments/${apartmentId}`));
    const apartmentData = apartmentSnap.exists() ? apartmentSnap.data() : null;
  
    if (!apartmentData) {
      this.userNotFound = true;
      return;
    }
  
    if (apartmentData['locked']) {
      this.isBlockingMessageShown = true;
      this.modalService.show(
        `🚫 Access denied. Your apartment is locked by SuperAdmin.\nReason: ${apartmentData['lockedReason'] || 'No reason specified.'}`,
        'warning',
        '',
        () => { this.isBlockingMessageShown = false;  document.getElementById('phoneNumber')?.focus();}
      );
      return;
    }
  
    const adminsRef = collection(firestore, `apartments/${apartmentId}/admins`);
    const querySnapshot = await getDocs(adminsRef);
    const isAnyAdminApproved = querySnapshot.docs.some(doc => doc.data()['approved'] === true);
  
    if (!isAnyAdminApproved) {
      this.isBlockingMessageShown = true;
      this.modalService.show(
        '⚠️ Your apartment admin is not yet approved by SuperAdmin.',
        'warning',
        '',
        () => { this.isBlockingMessageShown = false;  document.getElementById('phoneNumber')?.focus();}
      );
      return;
    }
  
    if (this.isTrialExpired(apartmentData)) {
      this.isBlockingMessageShown = true;
      this.modalService.show(
        '❌ Trial expired. Please contact your admin.',
        'warning',
        '',
        () => { this.isBlockingMessageShown = false;   document.getElementById('phoneNumber')?.focus();}
      );
      return;
    }
  }
  
  
  

  // async onPhoneNumberChange1() {
  //   const phone = this.phoneNumber.trim();
  //   this.userNotFound = false;
  
  //   if (!phone || phone.length !== 10) return;
  
  //   const firestore = this.firestoreService.getFirestore();
  
  //   // 🔍 1. Check Admins
  //   const apartmentData = await this.checkAdminByPhone(firestore, phone);
  //   if (apartmentData) {
  //     if (this.isTrialExpired(apartmentData)) {
  //       this.userNotFound = true;
  //       this.modalService.show('Trial expired. Please upgrade your plan to log in','warning')
  //       return;
  //     }
  //     return;
  //   }
    

  //   const isFlatOwner = await this.checkFlatOwnerByPhone(firestore, phone);
  //   if (isFlatOwner) {
  //   // At this point, apartmentId is already set via this.apartmentId in your method
  //     const apartmentId = this.apartmentId;

  //     const apartmentSnap = await getDoc(doc(firestore, `apartments/${apartmentId}`));
  //     const apartmentData = apartmentSnap.exists() ? apartmentSnap.data() : null;

  //     if (!apartmentData) {
  //       this.userNotFound = true;
  //       return;
  //     }

  //     // 🚫 Check if apartment is locked
  //     if (apartmentData['locked']) {
  //       this.modalService.show('Access denied. Your apartment is locked by SuperAdmin.\nReason: ' + (apartmentData['lockedReason'] || 'No reason specified.'),'warning')
  //       this.userNotFound = true;
  //       return;
  //     }

  //     // Check if admin of that apartment is approved
  //     const adminsRef = collection(firestore, `apartments/${apartmentId}/admins`);
  //     const querySnapshot = await getDocs(adminsRef);
  //     const isAnyAdminApproved = querySnapshot.docs.some(doc => doc.data()['approved'] === true);

  //     if (!isAnyAdminApproved) {
  //       this.modalService.show('⚠️ Your apartment admin is not yet approved by SuperAdmin.' ,'warning')
  //       this.userNotFound = true;
  //       return;
  //     }

  //     // Trial expired
  //     if (this.isTrialExpired(apartmentData)) {
  //       this.modalService.show('❌ Trial expired. Please contact your admin.' ,'warning')
  //       this.userNotFound = true;
  //       return;
  //     }
  //     return;
  //   }

  //   const isSpouse = await this.checkSpouseByPhone(firestore, phone);
  //   if (isSpouse){
  //     const apartmentSnap = await getDoc(doc(firestore, `apartments/${this.apartmentId}`));
  //     const apartmentData = apartmentSnap.exists() ? apartmentSnap.data() : null;
  
  //     if (!apartmentData) {
  //       this.userNotFound = true;
  //       return;
  //     }

  //     if (apartmentData['locked']) {
  //       this.modalService.show('🚫 Access denied. Your apartment is locked by SuperAdmin.\nReason: ' + (apartmentData['lockedReason'] || 'No reason specified.') ,'warning')
  //       this.userNotFound = true;
  //       return;
  //     }
  //     const adminsRef = collection(firestore, `apartments/${this.apartmentId}/admins`);
  //     const querySnapshot = await getDocs(adminsRef);
  //     const isAnyAdminApproved = querySnapshot.docs.some(doc => doc.data()['approved'] === true);
  
  //     if (!isAnyAdminApproved) {
  //       this.modalService.show('⚠️ Your apartment admin is not yet approved by SuperAdmin.' ,'warning')
  //       this.userNotFound = true;
  //       return;
  //     }
  
  //     if (this.isTrialExpired(apartmentData)) {
  //       this.modalService.show('❌ Trial expired. Please contact your admin.' ,'warning')
  //       this.userNotFound = true;
  //       return;
  //     }
  //     return;
  //   }

  
  //   // 🔍 3. Check SuperAdmins
  //   const isSuperAdmin = await this.checkSuperAdminByPhone(firestore, phone);
  //   if (isSuperAdmin) return;
  
  //   this.userNotFound = true;
  //   this.blnSendOTP = true;
  //   console.warn('No user found with that phone number.');
  // }

  isTrialExpired(apartmentData: any): boolean {
    if (apartmentData?.plan !== 'trial') return false;
  
    const expiry = new Date(apartmentData.trialExpiry);
    const now = new Date();
  
    return isNaN(expiry.getTime()) || now > expiry;
  }
  
  async checkSpouseByPhone(firestore: Firestore, phone: string): Promise<boolean> {
    const apartmentsSnapshot = await getDocs(collection(firestore, 'apartments'));
  
    for (const apartmentDoc of apartmentsSnapshot.docs) {
      const apartmentId = apartmentDoc.id;
      const apartmentData = apartmentDoc.data(); // ✅ Needed for apartmentName
      const flatOwnersSnapshot = await getDocs(collection(firestore, `apartments/${apartmentId}/flatOwners`));
  
      for (const ownerDoc of flatOwnersSnapshot.docs) {
        const ownerData = ownerDoc.data();
        const spouse = ownerData['spouse'];
  
        if (spouse?.phoneNumber === phone && spouse?.accessEnabled) {
          // ✅ Save metadata
          this.apartmentId = apartmentId;
          this.apartmentName = apartmentData['name'] || 'Apartment';
  
          const resolvedRole = 'resident';
  
          const adminDataRaw: Admin = {
            name: spouse.name || ownerData['name'],
            role: resolvedRole,
            apartmentName: this.apartmentName,
            approvalDate: '',
            approvalStatus: '',
            approved: true,
            block: '', // Add if needed
            creationDate: new Date().toISOString(),
            email: '',
            flatNumber: ownerData['flat'],
            flatOwnerId: '', // You can fill this if needed
            phone: spouse.phoneNumber,
            isActive: true
          };
          this.pendingAdminData = adminDataRaw;
          //this.authService.setAdminDetails(adminDataRaw);
          return true;
        }
      }
    }
  
    return false;
  }
  
  
  private async checkAdminByPhone(firestore: Firestore, phone: string): Promise<any | false> {
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
  
        // 🚫 If apartment is locked by SuperAdmin
        if (apartmentData['locked']) {
          this.isAdminApproved = false;
          this.modalService.show('🚫 Access denied. Your apartment is locked by SuperAdmin.\nReason: ' + (apartmentData['lockedReason'] || 'No reason specified.') ,'warning')
          return false;
        }
  
        // 🟡 Approval Check (Skip if superadmin)
        if (adminData['adminRole'] !== 'superadmin' && !adminData['approved']) {
          this.isAdminApproved = false;
          this.modalService.show('⚠️ Your registration is pending SuperAdmin approval.' ,'warning')
          return false;
        }
  
        // ✅ Set login state
        this.isAdminApproved = true;
        this.apartmentName = apartmentData['name'] || null;
        this.apartmentId = apartmentId;
        this.role = adminData['adminRole'] || 'Admin';
  
        this.currentUser = {
          role: adminData['adminRole'] || 'Admin',
          apartment: apartmentId
        };
 
        console.log('Logged in as Admin:', adminData);

        const adminDataRaw: Admin = {
          name: adminData['adminName'] || adminData['name'] || 'Admin',
          role: adminData['adminRole'],
          apartmentName: adminData['apartmentName'],
          approvalDate: adminData['approvalDate'],
          approvalStatus: adminData['approvalStatus'],
          approved: adminData['approved'],
          block: adminData['block'],
          creationDate: adminData['creationDate'],
          email: adminData['email'],
          flatNumber: adminData['flatNumber'],
          flatOwnerId: adminData['flatOwnerId'],
          phone: adminData['phoneNumber'],
          isActive: adminData['approved']
        };
        
        this.pendingAdminData = {
          ...adminDataRaw,
          name: adminData['adminName'] || adminData['name'] || 'Admin'
        };
        // 🔄 Update userIndex
        await this.firestoreService.updateUserIndex(
          phone,
          adminData['adminRole'] || 'admin',
          'admin',
          apartmentId,
          adminData['flatOwnerId'] || '',
          this.apartmentName || ''
        );

       // this.authService.setAdminDetails(adminDataRaw);

        if (adminData['creationDate'] instanceof Timestamp) {
          const creationDate = adminData['creationDate'].toDate();
          console.log('Admin Creation Date:', creationDate);
        }
  
        return apartmentData; // ✅ Return apartmentData for lock/trial checks
      }
    }
  
    return false;
  }
  

  // private async checkFlatOwnerByPhone(firestore: Firestore, phone: string): Promise<boolean> {
  //   const apartmentsRef = collection(firestore, 'apartments');
  //   const apartmentSnapshots = await getDocs(apartmentsRef);
  
  //   for (const apartmentDoc of apartmentSnapshots.docs) {
  //     const apartmentId = apartmentDoc.id;
  //     const apartmentData = apartmentDoc.data();
  //     const flatOwnersRef = collection(firestore, 'apartments', apartmentId, 'flatOwners');
  //     const ownerQuery = query(flatOwnersRef, where('phoneNumber', '==', phone));
  //     const ownerSnapshot = await getDocs(ownerQuery);
  
  //     if (!ownerSnapshot.empty) {
  //       const ownerData = ownerSnapshot.docs[0].data();
  
  //       this.apartmentName = apartmentData['name'] || null;
  //       this.apartmentId = apartmentId;
  //       this.role = ownerData['role'] === 'resident' ? 'resident' : ownerData['role'];
  
  //       this.currentUser = {
  //         role: 'resident',
  //         apartment: apartmentId,
  //         flat: ownerData['flat'],
  //         name: ownerData['name'],
  //         phoneNumber: ownerData['phoneNumber'],
  //       };
  
  //       console.log('Logged in as Resident:', this.currentUser);
  //       return true;
  //     }
  //   }
  
  //   return false;
  // }

  private async checkFlatOwnerByPhone(firestore: Firestore, phone: string): Promise<any | false> {
    const apartmentsRef = collection(firestore, 'apartments');
    const apartmentSnapshots = await getDocs(apartmentsRef);
  
    for (const apartmentDoc of apartmentSnapshots.docs) {
      const apartmentId = apartmentDoc.id;
      const apartmentData = apartmentDoc.data();
  
      const flatOwnersRef = collection(firestore, 'apartments', apartmentId, 'flatOwners');
      const ownerQuery = query(flatOwnersRef, where('phoneNumber', '==', phone));
      const ownerSnapshot = await getDocs(ownerQuery);
  
      if (!ownerSnapshot.empty) {
        const ownerData = ownerSnapshot.docs[0].data();
  
        // 🚫 If apartment is locked
        if (apartmentData['locked']) {
          this.modalService.show('🚫 Access denied. Your apartment is locked by SuperAdmin.\nReason: ' + (apartmentData['lockedReason'] || 'No reason specified.') ,'warning')
          return false;
        }

        const rawRole = ownerData['role'];
        const resolvedRole: 'resident' | 'admin' | 'superadmin' = 
          rawRole === 'admin' || rawRole === 'superadmin' ? rawRole : 'resident';

        this.apartmentName = apartmentData['name'] || '';
        this.apartmentId = apartmentId;
        this.role = resolvedRole;

        this.currentUser = {
          role: resolvedRole,
          apartment: apartmentId,
          flat: ownerData['flat'],
          name: ownerData['name'],
          phoneNumber: ownerData['phoneNumber']
        };
    
        const adminDataRaw: Admin = {
          name: ownerData['name'],
          role: resolvedRole,
          apartmentName:  this.apartmentName,
          approvalDate: '',
          approvalStatus: '',
          approved: true,
          block: '', // if you have block info, add here
          creationDate: new Date().toISOString(), // or leave empty if not needed
          email: '',
          flatNumber: ownerData['flat'],
          flatOwnerId: '', // set if available
          phone: ownerData['phoneNumber'],
          isActive: true
        };
        this.pendingAdminData = adminDataRaw;
        // 🔄 Update userIndex for resident/admin/superadmin flatOwner
        await this.firestoreService.updateUserIndex(
          ownerData['phoneNumber'],
          resolvedRole,
          'flatOwner',
          apartmentId,
          ownerSnapshot.docs[0].id,
          this.apartmentName || ''
        );

        //this.authService.setAdminDetails(adminDataRaw);
        console.log('Logged in as Resident:', this.currentUser);
        return apartmentData; // Return apartment data for trial check
      }
    }
  
    return false;
  }
  
  private async checkSecurityByPhone(firestore: Firestore, phone: string): Promise<any | false> {
    const apartmentsRef = collection(firestore, 'apartments');
    const apartmentSnapshots = await getDocs(apartmentsRef);
  
    for (const apartmentDoc of apartmentSnapshots.docs) {
      const apartmentId = apartmentDoc.id;
      const apartmentData = apartmentDoc.data();
  
      const securityRef = collection(firestore, 'apartments', apartmentId, 'securityUsers');
      const securityQuery = query(securityRef, where('phoneNumber', '==', phone));
      const securitySnapshot = await getDocs(securityQuery);
  
      if (!securitySnapshot.empty) {
        const securityData = securitySnapshot.docs[0].data();
  
        // 🚫 If apartment is locked
        if (apartmentData['locked']) {
          this.modalService.show(
            '🚫 Access denied. Your apartment is locked by SuperAdmin.\nReason: ' + (apartmentData['lockedReason'] || 'No reason specified.'),
            'warning'
          );
          return false;
        }
  
        this.role = 'security';
        this.apartmentId = apartmentId;
        this.apartmentName = apartmentData['name'] || '';
  
        this.currentUser = {
          role: 'security',
          apartment: apartmentId,
          name: securityData['name'],
          phoneNumber: securityData['phoneNumber']
        };
  
        const adminDataRaw: Admin = {
          name: securityData['name'],
          role: 'security' as any,  // cast to bypass TS constraint since "security" isn't in Admin.role type
          apartmentName: this.apartmentName,
          approvalDate: '',
          approvalStatus: '',
          approved: true,
          block: '',
          creationDate: new Date().toISOString(),
          email: securityData['email'] || '',
          flatNumber: '',
          flatOwnerId: '',
          phone: securityData['phoneNumber'],
          isActive: true
        };
  
        this.pendingAdminData = adminDataRaw;
        console.log('Logged in as Security:', this.currentUser);
        return apartmentData; // for further use if needed
      }
    }
  
    return false;
  }
  
  

    private async checkSuperAdminByPhone(firestore: Firestore, phone: string): Promise<boolean> {
      const superAdminRef = collection(firestore, 'superadmin'); // Use lowercase as per your structure
      const superAdminQuery = query(superAdminRef, where('phone', '==', phone));
      const snapshot = await getDocs(superAdminQuery);

      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        this.role = 'SuperAdmin';
        this.apartmentId = null;
        this.apartmentName = '';
        this.currentUser = {
          role: 'superadmin',
        };
        console.log('Logged in as SuperAdmin:', data);
        return true;
      }
      return false;
    }

  // async onPhoneNumberChange() {
  //   const phone = this.phoneNumber.trim();

  //   if (!phone) {
  //     console.warn('Phone number is empty');
  //     return;
  //   }

  //   // 🔍 Check 'admins'
  //   const adminRef = collection(this.firestoreService.getFirestore(), 'admins');
  //   const adminQuery = query(adminRef, where('phone', '==', phone));
  //   const adminSnapshot = await getDocs(adminQuery);

  //   if (!adminSnapshot.empty) {
  //     const adminData = adminSnapshot.docs[0].data();
  //     this.apartmentName = this.apartmentId = adminData['apartmentId'] || null;
  //     this.role = 'Admin';
  //     console.log('Logged in as Admin:', adminData);
  //     return;
  //   }

  //   // 🔍 Check 'flatOwners'
  //   const ownerRef = collection(this.firestoreService.getFirestore(), 'flatOwners');
  //   const ownerQuery = query(ownerRef, where('phone', '==', phone));
  //   const ownerSnapshot = await getDocs(ownerQuery);

  //   if (!ownerSnapshot.empty) {
  //     const ownerData = ownerSnapshot.docs[0].data();
  //     this.apartmentName = this.apartmentId = ownerData['apartmentId'] || null;
  //     this.role = 'FlatOwner';
  //     console.log('Logged in as FlatOwner:', ownerData);
  //     return;
  //   }

  //   // ❌ Not found
  //   this.apartmentId = null;
  //   this.role = null;
  //   console.error('No user found with that phone number.');
  // }

  
  // async onPhoneNumberChange() {
  //   this.availableApartments = [];
  //   this.apartmentName = '';
  //   this.showApartmentDropdown = false;
  //   this.currentUser = null;

  //   if (!this.phoneNumber) return;

  //   const db = getFirestore();
  //   const usersRef = collection(db, 'users');
  //   const q = query(usersRef, where('phoneNumber', '==', this.phoneNumber));

  //   try {
  //     const querySnapshot = await getDocs(q);
  //       if (!querySnapshot.empty) {
  //         // Get the first document from the query snapshot
  //         const userDoc = querySnapshot.docs[0];
          
  //         // Assuming that the data returned is of type 'UserData'
  //         const userData: UserData = userDoc.data() as UserData;  // Type assertion
          
  //         // Set currentUser to the fetched user data
  //         this.currentUser = userData;
        

  //         if (userData['role'] === 'SuperAdmin') {
  //           this.showApartmentDropdown = false;
  //         } else if (userData['apartment']) {
  //           this.availableApartments = [userData['apartment']];
  //           this.apartmentName = userData['apartment'];
  //           this.showApartmentDropdown = true;
  //         } else {
  //           this.availableApartments = this.allApartments;
  //           this.showApartmentDropdown = true;
  //         }
          
  //       } else {
  //       console.log('No user found with that phone number.');
  //     }
  //   } catch (error) {
  //     console.error('Error fetching user by phone number:', error);
  //   }
  // }

   // Simulate the error and show the message
   checkPhoneNumber(phoneNumber: string) {
    if (!this.isUserFound(phoneNumber)) {
      this.userNotFound = true; // Show error message
      setTimeout(() => {
        this.userNotFound = false; // Hide the message after 3 seconds
      }, 3000);
    }
  }

  isUserFound(phoneNumber: string): boolean {
    // Simulate user check
    return false;
  }

  showErrorModal() {
    this.userNotFound = true;
  }

  closeModal() {
    this.userNotFound = false;
  }

  async sendOTP() {
  if (this.userNotFound) {
    this.modalService.show('User not found. Please contact your property management.', 'warning');
    return;
  }

  const phone = (this.phoneNumber || '').trim();
  if (phone.length !== 10) {
    this.modalService.show('Please enter a valid 10-digit phone number', 'warning');
    return;
  }

  if (this.sendingOtp) return;
  this.sendingOtp = true;

  try {
    const res: any = await this.otpService.sendOtp(phone);
    // 2Factor success shape: { Status: 'Success', Details: '<sessionId>' }
    if (res?.Status === 'Success' && res?.Details) {
      this.sessionId = res.Details;
      this.otpSent = true;
      this.modalService.show('OTP sent successfully!', 'success');
    } else {
      const msg = res?.Details || 'Failed to send OTP. Please try again.';
      this.modalService.show(msg, 'error');
      console.error('OTP send failed:', res);
    }
  } catch (err: any) {
    console.error('Error sending OTP:', err);
    const msg = err?.error?.Details || err?.message || 'Something went wrong while sending OTP';
    this.modalService.show(msg, 'error');
  } finally {
    this.sendingOtp = false;
  }
}

async verifyOTP(forceResetPin: boolean = false) {
  const otp = (this.otpCode || '').trim();
  if (!otp) {
    this.modalService.show('Please enter the OTP', 'warning');
    return;
  }
  if (!this.sessionId) {
    this.modalService.show('Session expired. Please resend the OTP.', 'error');
    return;
  }

  if (this.verifyingOtp) return;
  this.verifyingOtp = true;

  try {
    const res: any = await this.otpService.verifyOtp(this.sessionId, otp);
    // Success shape: { Status: 'Success', Details: 'OTP Matched' }
    if (res?.Status === 'Success') {
      await this.finishLoginAfterOtpVerified(forceResetPin);
    } else {
      const msg = res?.Details || 'Invalid OTP!';
      this.modalService.show(msg, 'error');
      console.warn('Verify OTP failed:', res);
    }
  } catch (err: any) {
    console.error('Error verifying OTP:', err);
    const msg = err?.error?.Details || err?.message || 'OTP verification failed. Please try again later.';
    this.modalService.show(msg, 'error');
  } finally {
    this.verifyingOtp = false;
  }
}

  async sendOTP1() {
    // Check if user exists
    if (this.userNotFound) {
      this.modalService.show(
        'User not found. Please contact your property management.',
        'warning'
      );
      return;
    }
  
    // Validate phone number
    if (!this.phoneNumber || this.phoneNumber.trim().length !== 10) {
      this.modalService.show('Please enter a valid 10-digit phone number', 'warning');
      return;
    }
  
    try {
      // 🔹 Call OTP Service
      const response: any = await this.otpService.sendOtp(this.phoneNumber);
  
      console.log('2Factor OTP Response:', response);
  
      if (response?.Status === 'Success') {
        this.sessionId = response.Details; // Store session ID for verifyOtp()
        this.otpSent = true;
  
        console.log('OTP Sent Successfully');
        this.modalService.show('OTP sent successfully!', 'success');
      } else {
        console.error('OTP Send Failed:', response);
        this.modalService.show(
          response?.Details || 'Failed to send OTP. Please try again.',
          'error'
        );
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      this.modalService.show('Something went wrong while sending OTP', 'error');
    }
  }
  

  // sendOTP() {
  //   if (this.userNotFound) {
  //     this.modalService.show('User not found. Please contact your property management.', 'warning');
  //     return;
  //   }
  
  //   if (!this.phoneNumber || this.phoneNumber.length !== 10) {
  //     this.modalService.show('Please enter a valid 10-digit phone number.', 'warning');
  //     return;
  //   }
  
  //   const fullPhoneNumber = `+91${this.phoneNumber.trim()}`; // ✅ Use +91 or your country code
  //   const auth = getAuth();
  
  //   // ✅ Initialize Recaptcha only once
  //   if (!(window as any).recaptchaVerifier) {
  //     (window as any).recaptchaVerifier = new RecaptchaVerifier(
  //        auth,'recaptcha-container',  
  //       {
  //         size: 'invisible',
  //         callback: () => {
  //           console.log('reCAPTCHA passed. Sending OTP...');
  //         }
  //       },
       
  //     );
  //   }
  
  //   const appVerifier = (window as any).recaptchaVerifier;
  
  //   signInWithPhoneNumber(auth, fullPhoneNumber, appVerifier)
  //     .then((confirmationResult) => {
  //       this.confirmationResult = confirmationResult; // ✅ Store for verification
  //       this.otpSent = true;
  //       this.modalService.show(`OTP sent to ${this.phoneNumber}`, 'success');
  //     })
  //     .catch((error) => {
  //       console.error('OTP send error', error);
  //       this.modalService.show('Failed to send OTP. Please try again.', 'error');
  //     });
  // }
  
  async verifyOTP1(forceResetPin: boolean = false) {
    // Check if OTP field is empty
    if (!this.otpCode || this.otpCode.trim().length === 0) {
      this.modalService.show('Please enter the OTP', 'warning');
      return;
    }
  
    if (!this.sessionId) {
      this.modalService.show('Session expired. Please resend the OTP.', 'error');
      return;
    }
  
    try {
      // Call the OTP service to verify OTP
      const response: any = await this.otpService.verifyOtp(this.sessionId, this.otpCode);
      console.log("Verify OTP Response:", response);
  
      if (response?.Status === 'Success') {
        // OTP is valid → Proceed to login
        await this.finishLoginAfterOtpVerified(forceResetPin);
      } else {
        // Invalid OTP → Show response details if provided
        this.modalService.show(response?.Details || 'Invalid OTP!', 'error');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      this.modalService.show('OTP verification failed. Please try again later.', 'error');
    }
  }
  
  
  async finishLoginAfterOtpVerified(forceResetPin: boolean = false) {
    try {
      if (!this.pendingAdminData) {
        this.modalService.show('Unexpected error. Please login again.', 'error');
        return;
      }
  
      const role = this.pendingAdminData.role?.toLowerCase() || '';
      const userId = this.pendingAdminData.userId || this.pendingAdminData.flatOwnerId || null;
  
      if (!userId) {
        this.modalService.show('User ID missing. Please try again.', 'error');
        return;
      }
  
      const user = {
        phone: this.pendingAdminData.phone || '',
        apartmentId: this.apartmentId || '',
        name: this.pendingAdminData.name || 'Admin',
        role: role,
        otpVerified: true
      };
  
      // Save session data
      localStorage.setItem('apartmentName', this.pendingAdminData.apartmentName || '');
      localStorage.setItem('userName', user.name);
      localStorage.setItem('phoneNumber', user.phone);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('biometricLoginEnabled', 'true');
      localStorage.setItem('userRole', role);
      localStorage.setItem('apartmentId', user.apartmentId);
      localStorage.setItem('userType', this.mapRoleToUserType(role));
      localStorage.setItem('userId', userId);
      localStorage.setItem('sessionExpiry', (Date.now() + 1000 * 60 * 60).toString());
  
      // Set admin details in service
      const fullAdminData: Admin = {
        ...this.pendingAdminData,
        name: user.name,
        phone: user.phone,
        apartmentName: this.apartmentName,
        role: role as ExtendedRole
      };
  
      this.authService.setAdminDetails(fullAdminData);
      this.authService.setOtpVerified(true);
      this.authService.startIdleMonitor();
  
      // ✅ Re-check PIN status using centralized function
      const pinExists = await this.checkPinInFirestore();
      localStorage.setItem('pinSet', pinExists ? 'true' : 'false');
  
      if (forceResetPin || !pinExists) {
        this.router.navigate(['/set-pin']);
        return;
      }
  
      // Navigate based on role
      switch (role) {
        case 'admin': this.router.navigate(['/admin']); break;
        case 'superadmin': this.router.navigate(['/superadmin']); break;
        case 'security': this.router.navigate(['/security']); break;
        default: this.router.navigate(['/dashboard']); break;
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      this.modalService.show('Error verifying OTP. Please try again later.', 'error');
    }
  }
  

  
  mapRoleToUserType(role: string | undefined | null): 'admins' | 'flatOwners' | 'securityUsers' | 'superadmin'  {
    if (!role || typeof role !== 'string') {
      return 'flatOwners';
    }
  
    switch (role.toLowerCase()) {
      case 'admin':
        return 'admins';
      case 'superadmin':
        return 'superadmin';
      case 'owner':
      case 'resident':
        return 'flatOwners';
      case 'security':
        return 'securityUsers';
      default:
        return 'flatOwners';
    }
  }
  
  
  
  // async verifyOTP() {
  //   if (!this.otpCode) {
  //     alert('Please enter the OTP');
  //     return;
  //   }
  
  //   if (this.otpCode !== this.generatedOtp) {
  //     alert('Invalid OTP!');
  //     return;
  //   }
  
  //   try {
  //     //const confirmResult = await this.confirmationResult.confirm(this.otpCode);
  //     //const firebaseUser = confirmResult.user;
  //     const result = await this.firestoreService.getUserByPhoneNumber(this.phoneNumber.trim());
  
  //     if (!result) {
  //       alert('User not found!');
  //       return;
  //     }
  
  //     if (result) {
  //       const { userData, role } = result;
  //       this.role = role;
      
  //       let { apartmentId, name, phoneNumber } = userData;

  //       if (apartmentId == null) {
  //         // First assert as 'unknown', then cast to the correct type
  //         apartmentId = (result as unknown as { apartmentId: string }).apartmentId;
  //       }

  //        // Store user data
  //     localStorage.setItem('apartmentName', apartmentId);
  //     localStorage.setItem('userName', name);
  //     localStorage.setItem('phoneNumber', phoneNumber);
  //     localStorage.setItem('user', JSON.stringify({
  //       phone: phoneNumber,
  //       apartmentId,
  //       name,
  //       role
  //     }));
  //   }
     
  
  //     // Start session tracking
  //     this.authService.startIdleMonitor();
  
  //     // Route based on role
  //     switch (this.role) {
  //       case 'Admin':
  //         this.router.navigate(['/admin']);
  //         break;
  //       case 'SuperAdmin': // Just in case you add SuperAdmins in Firestore later
  //         this.router.navigate(['/superadmin']);
  //         break;
  //       case 'FlatOwner':
  //       default:
  //         this.router.navigate(['/dashboard']);
  //         break;
  //     }
  
  //   } catch (error) {
  //     console.error('Error verifying OTP:', error);
  //     alert('Error verifying OTP. Please try again later.');
  //   }
  // }
  

  async submitInterest() {
    const name = this.interestName.trim();
    const phone = this.interestPhone.trim();
    const message = this.interestMessage.trim();
  
    if (!name || !phone) {
      this.snackBar.open('Please enter both name and phone number.', 'Close', { duration: 3000 });
      return;
    }
  
    // 💬 Profanity check
    const filter = new Filter();
    if (filter.isProfane(message)) {
      this.snackBar.open('Please remove inappropriate words from the message.', 'Close', { duration: 4000 });
      return;
    }
  
    await addDoc(collection(this.firestoreService.getFirestore(), 'contactRequests'), {
      name,
      phone,
      message,
      timestamp: new Date()
    });
  
    this.snackBar.open('Thank you! We’ll reach out soon.', 'Close', { duration: 3000 });
  
    this.interestSubmitted = true;
    this.interestName = '';
    this.interestPhone = '';
    this.interestMessage = '';
    this.showContactForm = false;
  }
  
  
  

  getUserdetails(apartmentName: any, phoneNumber: any) {
    this.firestoreService.getUserDetails(apartmentName, phoneNumber).then(user => {
      if (user) {
        localStorage.setItem('userName', user.name);
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('phoneNumber', phoneNumber);
        localStorage.setItem('apartmentName', apartmentName);
        this.router.navigate(['/dashboard']);
      } else {
        this.modalService.show('User not found' ,'error')
        }
    });
  }
  blockedWords = ['badword1', 'badword2', 'offensiveword']; // Replace with actual vulgar terms

  containsProfanity(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return this.blockedWords.some(word => lowerMessage.includes(word));
  }
  navigateToEnrollment(): void {
    this.router.navigate(['/enrollment']);
  }
  reloadPage(event: MouseEvent) {
    event.preventDefault();
    window.location.href = '/'; 
  }
 }
