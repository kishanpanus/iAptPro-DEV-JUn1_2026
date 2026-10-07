import { Component } from '@angular/core';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc
} from 'firebase/firestore';
import { FirestoreService } from '../services/services/firestore.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { ModalService } from '../services/services/model.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-security',
  standalone: true,
  imports: [CommonModule,ZXingScannerModule,FormsModule],
  templateUrl: './security.component.html',
  styleUrl: './security.component.css'
})
export class SecurityComponent {
  gatePasses: any[] = [];
  apartmentId: string | null = null;
  visitorInfo: any = null;
  isScanning = false;
  selectedDevice: MediaDeviceInfo | undefined = undefined;
  manualVisitor = {
    name: '',
    phone: '',
    purpose: '',
    flat: ''
  };
  visitorLogs: any[] = [];
  constructor(
    public router: Router,
    private firestoreService: FirestoreService,private modalService: ModalService
  ) {}

  ngOnInit() {
    this.fetchGatePassesForSecurity();
  }

  async fetchGatePassesForSecurity() {
    const phone = localStorage.getItem('phoneNumber');
    if (!phone) return;
  
    const firestore = this.firestoreService.getFirestore();
    const apartmentsSnap = await getDocs(collection(firestore, 'apartments'));
  
    for (const apartmentDoc of apartmentsSnap.docs) {
      const apartmentId = apartmentDoc.id;
      const securitySnap = await getDocs(collection(firestore, `apartments/${apartmentId}/securityUsers`));
  
      for (const secDoc of securitySnap.docs) {
        const secData = secDoc.data();
        if (secData['phoneNumber'] === phone) {
          this.apartmentId = apartmentId;
          this.apartmentId = localStorage.getItem('apartmentId');
          await this.loadAllGatePasses();
          await this.fetchVisitorLogs();
          return; 
        }
      }
    }
  
    console.warn('Apartment not found for logged-in security user');
  }
  

  async loadAllGatePasses() {
    const firestore = this.firestoreService.getFirestore();
    const gatePassesQuery = query(collectionGroup(firestore, 'gatePasses'));
    const snapshot = await getDocs(gatePassesQuery);

    const gatePassList: any[] = [];

    for (const docSnap of snapshot.docs) {
      const gatePassData = docSnap.data();
      const fullPath = docSnap.ref.path;

      const pathParts = fullPath.split('/');
      const apartmentId = pathParts[1];
      const flatOwnerId = pathParts[3];

      if (this.apartmentId && apartmentId !== this.apartmentId) continue;

      const flatOwnerDocRef = doc(firestore, `apartments/${apartmentId}/flatOwners/${flatOwnerId}`);
      const flatOwnerDoc = await getDoc(flatOwnerDocRef);
      const flatData = flatOwnerDoc.exists() ? flatOwnerDoc.data() : {};

      gatePassList.push({
        id: docSnap.id,
        apartmentId,
        ownerPath: flatOwnerId,
        flat: flatData?.['flat'] || flatData?.['flatNumber'] || '',
        ...gatePassData
      });
    }

    this.gatePasses = gatePassList;
    console.log('Gate passes:', this.gatePasses);
  }

  updateStatus(pass: any, newStatus: string) {
    const firestore = this.firestoreService.getFirestore();
    const path = `apartments/${pass.apartmentId}/flatOwners/${pass.ownerPath}/gatePasses/${pass.id}`;
    const docRef = doc(firestore, path);

    updateDoc(docRef, { status: newStatus }).then(() => {
      pass.status = newStatus;
    });
  }

  async onQRCodeScanned(data: string) {
    try {
      const parsed = JSON.parse(data);
  
      // Optional: check for expiry
      const expected = new Date(parsed.time);
      const now = new Date();
  
      if (parsed.used) {
        alert('⚠️ This QR has already been used.');
      } else if (expected < now) {
        alert('⏰ QR code has expired.');
      } else {
        this.visitorInfo = parsed;
  
        await this.firestoreService.logVisitor( this.apartmentId!,{
          ...this.visitorInfo,
          source: 'qr',
          used: true,
          time: new Date(this.visitorInfo.time)
        });
        
      }
    } catch (err) {
      console.error('Invalid QR Code:', err);
      alert('Invalid QR code.');
    }
  }

  startScanner() {
    this.isScanning = true;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      this.selectedDevice = videoDevices[0];
    });
  }
  
  stopScanner() {
    this.isScanning = false;
    this.selectedDevice = undefined;
  }

  async logVisitorManually() {
    const { name, phone, purpose, flat } = this.manualVisitor;
  
    if (!name || !phone || !purpose || !flat) {
      this.modalService.show('Please fill all fields.', 'warning');
      return;
    }
  
    await this.firestoreService.logVisitor( this.apartmentId!,{
      name,
      phone,
      purpose,
      flat,
      time: new Date(),
      source: 'manual',
      used: true
    });
  
    this.modalService.show('Visitor manually logged ✅', 'success');
    this.manualVisitor = { name: '', phone: '', purpose: '', flat: '' };
  }
  async fetchVisitorLogs() {
    if (!this.apartmentId) return;
    this.visitorLogs = await this.firestoreService.getVisitorLogs(this.apartmentId);
  }
  exportLogs(format: 'csv' | 'pdf') {
  this.firestoreService.exportVisitorLogs(this.apartmentId!, format, this.visitorLogs);
}
}
