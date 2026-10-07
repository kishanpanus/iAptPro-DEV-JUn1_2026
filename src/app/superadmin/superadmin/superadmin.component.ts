import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, FormsModule } from '@angular/forms';
import { FirestoreService } from '../../services/services/firestore.service';
import { AdminUser, ServiceRequest } from '../../services/services/models/models';
import { AdminQuery } from '../../models/admin-query.model';
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { RouterModule } from '@angular/router';
import { ModalService } from '../../services/services/model.service';

interface Admin {
  name: string;
  phone: string;
  apartment: string;
}

interface AdminRequest {
  apartment: string;
  type: string;
  message: string;
}

export interface Apartment {
  id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  numberOfFlats: number;
  plan: string;
  trialExpiry?: string;
  locked?: boolean;
  isDeleted?: boolean;
}

@Component({
  selector: 'app-superadmin',
  standalone: true,
  imports: [CommonModule, FormsModule,RouterModule],
  templateUrl: './superadmin.component.html',
  styleUrl: './superadmin.component.css'
})
export class SuperadminComponent implements OnInit {
  adminName = '';
  adminPhone = '';
  apartmentName = '';
  admins: AdminUser[] = [];
  adminRequests: ServiceRequest[] = [];
  adminQueries: AdminQuery[] = [];
  allQueries: AdminQuery[] = [];
  contactRequests: any[] = [];
  objectKeys = Object.keys;
  groupedQueries: { [apartment: string]: AdminQuery[] } = {};
  collapsedApartments: { [apartment: string]: boolean } = {};
  registeredAdmins: any[] = [];
  isConfirmationVisible: boolean = false;
  itemToDeleteId: string | null = null;
  adminRole: string = 'admin'; // Default admin role
  flatOwnerRole: string | null = null; // Role if also a flat owner
  phoneNumber = '';
  isEditing: boolean = false;
  editingAdmin: any = null; // To store the admin being edited
  phoneNumberExists: boolean = false;
  flatOwnerExists: boolean = false;
  newApartment = { name: '' }; 
  apartments: Apartment[] = []; 
  selectedApartmentId = '';
  adminFlatNumber: string | null = null; // Optional field
  pendingAdmins: any[] =[];
  isDeleted: boolean = false;

  constructor(private firestoreService: FirestoreService,private modalService: ModalService) {}

  async ngOnInit(): Promise<void> {
    localStorage.setItem('user', 'true');
    localStorage.setItem('role', 'superadmin');
    localStorage.setItem('phoneNumber', "9846254635");
    console.log("Phonenumber->","9846254635");
    this.loadContactRequests();
    this.loadAllAdminQueries();
    await this.loadAdmins(); 
    await this.loadApartments();
    this.firestoreService.getAllAdmins().subscribe(data => {
      this.admins = data;
    });

    this.firestoreService.getAllServiceRequests().subscribe(data => {
      this.adminRequests = data as ServiceRequest[];

    });
    await this.loadPendingAdmins();
  }

  // Load apartments from Firestore
  async loadApartments() {
    const firestore = this.firestoreService.getFirestore();
    const snapshot = await getDocs(
      query(collection(firestore, 'apartments'))
    );
  
    this.apartments = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data['name'],
        address: data['address'],
        numberOfFlats: data['numberOfFlats'],
        plan: data['plan'],
        trialExpiry: data['trialExpiry'],
        locked: data['locked'],
        isDeleted: data['isDeleted'] || false,
      };
    });
  }
  
  
  async softDeleteApartment(apartmentId: string) {
    const docRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}`);
    await updateDoc(docRef, { isDeleted: true });
    this.loadApartments(); // Refresh list
  }
  

  async loadContactRequests() {
    const contactRef = collection(this.firestoreService.getFirestore(), 'contactRequests');
    const snapshot = await getDocs(contactRef);
    this.contactRequests = snapshot.docs.map(doc => doc.data());
    console.log(this.contactRequests );
  }

  deleteRequest(req: any) {
    console.log(req);
    if (req.id) {
      this.firestoreService.deleteContactRequest(req.id)
        .then(() => {
          console.log('Deleted successfully');
          this.contactRequests = this.contactRequests.filter(r => r.id !== req.id);
        })
        .catch(error => {
          console.error('Error deleting document:', error);
        });
    } else {
      console.warn('Request has no ID, cannot delete.');
    }
  }

 

  loadAllAdminQueries() {
    this.firestoreService.getAllAdminQueries().then(snapshot => {
      const queries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AdminQuery[];
  
      // Group and sort queries by timestamp (latest first)
      this.groupedQueries = queries.reduce((acc, query) => {
        const apt = query.apartment || 'Unknown';
        if (!acc[apt]) acc[apt] = [];
        acc[apt].push(query);
        return acc;
      }, {} as { [apartment: string]: AdminQuery[] });
  
      // Sort each apartment's queries by timestamp descending
      for (const apt in this.groupedQueries) {
        this.groupedQueries[apt].sort((a, b) => b.timestamp - a.timestamp);
      }
    });
  }
  
  toggleApartment(apartment: string) {
    this.collapsedApartments[apartment] = !this.collapsedApartments[apartment];
  }
  
  isCollapsed(apartment: string): boolean {
    return this.collapsedApartments[apartment];
  }
  
  resolveQuery(queryId: string) {
    this.firestoreService.resolveAdminQuery(queryId).then(() => {
      this.loadAllAdminQueries();
    });
  }

  deleteQuery(id: string) {
    this.itemToDeleteId = id;
    this.isConfirmationVisible = true;
    // if (confirm('Are you sure you want to delete this query?')) {
    //   this.firestoreService.deleteAdminQuery(id).then(() => {
    //     this.loadAllAdminQueries(); // Refresh list after deletion
    //   });
    // }
  }
  
  confirmDelete() {
    if (this.itemToDeleteId) {
      this.firestoreService.deleteAdminQuery(this.itemToDeleteId).then(() => {
        this.loadAllAdminQueries(); // Refresh list after deletion
        this.isConfirmationVisible = false; // Hide the modal
        this.itemToDeleteId = null; // Clear the ID
      });
    }
  }

  cancelDelete() {
    this.isConfirmationVisible = false; // Hide the modal
    this.itemToDeleteId = null; // Clear the ID
  }
  
  
  async addAdmin() {
    if (this.adminName && this.adminPhone && this.selectedApartmentId && this.adminRole) {
      try {
        const newAdminId = await this.firestoreService.addApartmentAdmin(
          this.adminName,
          this.adminPhone,
          this.selectedApartmentId, // Pass apartment ID
          this.adminRole,
          this.flatOwnerRole === null ? undefined : this.flatOwnerRole,
          this.adminFlatNumber || null // Pass flat number if available, else null
        );
  
        console.log('Admin added successfully with ID:', newAdminId);
        await this.loadAdmins();
  
        // Reset form
        this.adminName = '';
        this.adminPhone = '';
        this.selectedApartmentId = '';
        this.adminRole = 'admin';
        this.flatOwnerRole = null;
        this.adminFlatNumber = null;
  
      } catch (error: any) {
        console.error('Error adding admin:', error.message || error);
        this.modalService.show('Error adding admin:'+ error.message || error , 'error')
      }
    } else {
      this.modalService.show('Please fill all required fields.' , 'warning')
    }
  }
  
  
  

  editAdmin(admin: any) {
    this.editingAdmin = { ...admin }; // Create a copy to avoid direct modification
    this.isEditing = true;
  }

  // async saveEditedAdmin() {
  //   if (this.editingAdmin) {
  //     try {
  //       await this.firestoreService.updateAdmin(this.editingAdmin.apartmentName, this.editingAdmin.id, this.editingAdmin);
  //       this.isEditing = false;
  //       await this.loadAdmins(); // reload list
  //     } catch (error) {
  //       console.error('Error saving admin:', error);
  //     }
  //   }
  // }
  
  async saveEditedAdmin() {
    if (
      this.editingAdmin &&
      this.editingAdmin.adminName &&
      this.editingAdmin.phoneNumber &&
      this.editingAdmin.adminRole &&
      this.editingAdmin.apartmentName &&
      this.editingAdmin.id
    ) {
      try {
        // Make sure flatNumber is optional
        const updatedAdminData = {
          adminName: this.editingAdmin.adminName,
          phoneNumber: this.editingAdmin.phoneNumber,
          adminRole: this.editingAdmin.adminRole,
          flatOwnerRole: this.editingAdmin.flatOwnerRole || null,
          flatNumber: this.editingAdmin.flatNumber || null,
          apartmentName: this.editingAdmin.apartmentName,
          flatOwnerId: this.editingAdmin.flatOwnerId || null
        };
  
        await this.firestoreService.updateAdmin(this.editingAdmin.apartmentId, this.editingAdmin.id, this.editingAdmin);


  
        this.isEditing = false;
        await this.loadAdmins(); // Reload list
      } catch (error) {
        console.error('Error saving admin:', error);
        this.modalService.show('Failed to save changes. Please try again.' , 'warning')
      }
    } else {
      this.modalService.show('Please fill all required fields.' , 'warning')
    }
  }
  

  cancelEdit() {
    this.isEditing = false;
    this.editingAdmin = null;
  }

  async loadAdmins() {
    try {
      this.registeredAdmins = await this.firestoreService.loadAllAdmins();
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  }

  // async removeAdmin(admin: any) {
  //   if (confirm(`Are you sure you want to delete admin: ${admin.adminName}?`)) {
  //     try {
  //       await this.firestoreService.removeAdmin(admin.apartmentName, admin.id);
  //       await this.loadAdmins(); // reload
  //     } catch (error) {
  //       console.error('Error removing admin:', error);
  //     }
  //   }
  // }

  async removeAdmin(admin: any) {
    const confirmed = await this.modalService.show(`Are you sure you want to deactivate admin: ${admin.adminName}? This will also lock the apartment.`,'confirm');
    if (confirmed) {
      try {
        const db = this.firestoreService.getFirestore();
  
        // 1. Mark admin as deleted (or inactive)
        const adminRef = doc(db, `apartments/${admin.apartmentId}/admins/${admin.id}`);
        await updateDoc(adminRef, {
          deleted: true,
          deactivatedAt: new Date().toISOString()
        });
  
        // 2. Lock apartment
        const apartmentRef = doc(db, `apartments/${admin.apartmentId}`);
        await updateDoc(apartmentRef, {
          locked: true,
          lockedReason: 'Soft-deleted by SuperAdmin',
          lockedAt: new Date().toISOString()
        });
  
        // 3. Refresh list
        await this.loadAdmins();
  
      } catch (error) {
        console.error('Error soft-deleting admin/apartment:', error);
        this.modalService.show('❌ Failed to deactivate. Please try again.','error')
      }
    }
  }
  
  
  
  async resolveRequest(request: ServiceRequest) {
    const updatedData = {
      status: 'Resolved',
      responseMessage: request.responseMessage || '',
      resolvedAt: new Date()
    };
  
    const ref = doc(this.firestoreService.getFirestore(), `adminQueries/${request.id}`);
    updateDoc(ref, updatedData)
      .then(() => {
        this.modalService.show('✅ Marked as Resolved.', 'success');
        this.loadAdminQueries(); // Refresh list
      })
      .catch(err => {
        console.error('Error resolving request:', err);
        this.modalService.show('❌ Failed to resolve. Try again.', 'error');
      });
  }
  
  
  loadAdminQueries() {
    this.firestoreService.getAllAdminQueries()
      .then(snapshot => {
        this.adminQueries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as AdminQuery[];
      })
      .catch(err => console.error('Failed to fetch admin queries', err));
  }

  // Call this whenever phone or apartmentName changes
  async checkAdminDuplicate() {
    if (!this.adminPhone || !this.apartmentName) {
      this.phoneNumberExists = false;
      return;
    }
  
    try {
      this.phoneNumberExists = await this.firestoreService.isAdminPhoneUsed(
        this.apartmentName,
        this.adminPhone
      );
    } catch (err) {
      console.error('Error checking admin phone:', err);
      this.phoneNumberExists = false; // Fail-safe
    }
  }

  async addApartment() {
    try {
      // Ensure apartment name is provided
      if (!this.newApartment.name.trim()) {
        this.modalService.show('Apartment name is required.' , 'info')
        return;
      }

      // Call Firestore service to add the apartment
      const apartmentId = await this.firestoreService.addApartment(this.newApartment);
      console.log('Apartment added with ID:', apartmentId);

      // Reset form after successful addition
      this.newApartment.name = '';
      this.modalService.show('Apartment added successfully!' , 'success')
      this.loadApartments();
    } catch (error) {
      console.error('Error adding apartment:', error);
      this.modalService.show('Error adding apartment. Please try again.' , 'error')
    }
  }
  async loadPendingAdmins() {
    const firestore = this.firestoreService.getFirestore();
    const apartmentDocs = await getDocs(collection(firestore, 'apartments'));
  
    const fetchAdminPromises = apartmentDocs.docs.map(async (apt) => {
      const apartmentId = apt.id;
      const adminsSnap = await getDocs(collection(firestore, `apartments/${apartmentId}/admins`));
  
      return adminsSnap.docs
        .filter(docSnap => docSnap.data()['approved'] === false)
        .map(docSnap => ({
          apartmentId,
          adminId: docSnap.id,
          ...docSnap.data()
        }));
    });
  
    const allPending = await Promise.all(fetchAdminPromises);
    this.pendingAdmins = allPending.flat(); // Flatten nested arrays
  }
  
  // async loadPendingAdmins() {
  //   const firestore = this.firestoreService.getFirestore();
  //   const apartmentDocs = await getDocs(collection(firestore, 'apartments'));

  //   const pending: any[] = [];

  //   for (const apt of apartmentDocs.docs) {
  //     const apartmentId = apt.id;
  //     const adminsSnap = await getDocs(collection(firestore, `apartments/${apartmentId}/admins`));

  //     adminsSnap.forEach(docSnap => {
  //       const data = docSnap.data();
  //       if (data['approved'] === false) {
  //         pending.push({
  //           apartmentId,
  //           adminId: docSnap.id,
  //           ...data
  //         });
  //       }
  //     });
  //   }

  //   this.pendingAdmins = pending;
  // }

  async approveAdmin(apartmentId: string, adminId: string) {
    const firestore = this.firestoreService.getFirestore();
    const adminRef = doc(firestore, `apartments/${apartmentId}/admins/${adminId}`);
    await updateDoc(adminRef, {
      approved: true,
      approvalDate: new Date().toISOString(),
      approvalStatus: 'approved'
    });
    this.modalService.show('✅ Admin approved successfully.','success');
    await this.loadPendingAdmins();
    await this.loadAdmins();
  }

  async rejectAdmin(apartmentId: string, adminId: string, reason: string) {
    const firestore = this.firestoreService.getFirestore();
    const adminRef = doc(firestore, `apartments/${apartmentId}/admins/${adminId}`);
    await updateDoc(adminRef, {
      approved: false,
      approvalStatus: 'rejected',
      rejectionReason: reason,
      rejectionDate: new Date().toISOString()
    });
    this.modalService.show('❌ Admin rejected.','error');
    await this.loadPendingAdmins();
  }

  async lockApartment(apartmentId: string) {
    const docRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}`);
    await updateDoc(docRef, { locked: true, lockedReason: '❌ Payment not received' });
    this.modalService.show('🚫 Apartment locked.' , 'info')
    this.loadAdmins();
  }
  
  async unlockApartment(apartmentId: string) {
    const docRef = doc(this.firestoreService.getFirestore(), `apartments/${apartmentId}`);
    await updateDoc(docRef, { locked: false, lockedReason: '' });
    this.modalService.show('✅ Apartment unlocked.' , 'success')
    this.loadAdmins();
  }
  
  

  // async checkFlatOwnerDuplicate() {
  //   if (!this.newOwnerPhone || !this.apartmentName) {
  //     this.flatOwnerExists = false;
  //     return;
  //   }
  
  //   try {
  //     this.flatOwnerExists = await this.firestoreService.isFlatOwnerPhoneUsed(
  //       this.apartmentName,
  //       this.newOwnerPhone
  //     );
  //   } catch (error) {
  //     console.error('Error checking flat owner phone:', error);
  //     this.flatOwnerExists = false; // fail-safe
  //   }
  // }
}