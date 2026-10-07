import { inject, Injectable, Query } from '@angular/core';
import { Firestore, collection, collectionData, addDoc, doc, deleteDoc, getDocs, query, where, updateDoc, DocumentData, getDoc, CollectionReference, collectionGroup, Timestamp, serverTimestamp, DocumentReference, QuerySnapshot, orderBy, setDoc, documentId, limit, writeBatch } from '@angular/fire/firestore';
import { AdminUser } from '../../models/admin-user.model';
import { ServiceRequest } from '../../models/service-request';
import { from, map, Observable } from 'rxjs';
import { AdminQuery } from '../../models/admin-query.model';
import { Admin, Apartment, ExtendedRole, FlatOwner } from './models/models';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as Papa from 'papaparse';

type UserType = 'superadmin' | 'admins' | 'flatOwners' | 'securityUsers';

export interface UserIndexEntry {
  phoneNumber: string;
  role: 'admin' | 'owner' | 'resident' | 'superadmin' | 'security';
  userType: 'admin' | 'flatOwner' | 'superadmin' | 'security';
  source: 'admins' | 'flatOwners' | 'superadmin' | 'securityUsers';
  apartmentId?: string;
  apartmentName?: string;
  flatOwnerId?: string;
  flat?: string;
  name?: string;
}

export interface SubscriptionPlan {
  name: 'trial' | 'standard' | 'premium';
  price: number;
  description: string;
  razorpayPlanId: string;
  isActive: boolean;
  title: string; 
  features: string[];
}

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
    private firestore: Firestore
  constructor() {
    this.firestore = inject(Firestore); 
  }

  // async getUserByPhoneNumber(phoneNumber: string): Promise<{ userData: any, role: string, apartmentId?: string } | null> {
  //   const apartmentsRef = collection(this.firestore, 'apartments');
  //   const apartmentSnapshots = await getDocs(apartmentsRef);
  
  //   // Check in admins subcollections of each apartment
  //   for (const apartmentDoc of apartmentSnapshots.docs) {
  //     const apartmentId = apartmentDoc.id;
  //     const adminsRef = collection(this.firestore, 'apartments', apartmentId, 'admins');
  //     const adminQuery = query(adminsRef, where('phoneNumber', '==', phoneNumber));
  //     const adminSnapshot = await getDocs(adminQuery);
  
  //     if (!adminSnapshot.empty) {
  //       const adminData = adminSnapshot.docs[0].data();
  //       return {
  //         userData: adminData,
  //         role: adminData['adminRole'] || 'Admin',
  //         apartmentId: apartmentId
  //       };
  //     }
  //   }

  //    // 👩‍❤️‍👨 4. Check for Spouse Login (spouse.phoneNumber)
  //    const allFlatOwnersQuery = query(collectionGroup(this.firestore, 'flatOwners'));
  //    const allFlatOwnersSnapshot = await getDocs(allFlatOwnersQuery);
 
  //    for (const docSnap of allFlatOwnersSnapshot.docs) {
  //      const data = docSnap.data();
  //      if (data?.['spouse']?.['phoneNumber'] === phoneNumber && data?.['spouse']?.['accessEnabled']) {
  //       const apartmentId = docSnap.ref.parent?.parent?.id;
 
  //        return {
  //          userData: { ...data['spouse'], flatOwnerName: data['name'] },
  //          role: 'Spouse',
  //          apartmentId
  //        };
  //      }
  //    }
  
  //   // Check in SuperAdmin collection
  //   const superAdminRef = collection(this.firestore, 'superadmin');
  //   const superAdminQuery = query(superAdminRef, where('phone', '==', phoneNumber));
  //   const superAdminSnapshot = await getDocs(superAdminQuery);
  
  //   if (!superAdminSnapshot.empty) {
  //     const superAdminData = superAdminSnapshot.docs[0].data();
  //     return {
  //       userData: superAdminData,
  //       role: 'SuperAdmin'
  //     };
  //   }
  
  //   // Check in all flatOwners using a collectionGroup query
  //   try {
  //     const ownerQuery = query(
  //       collectionGroup(this.firestore, 'flatOwners'),
  //       where('phoneNumber', '==', phoneNumber) 
  //     );
  //     const ownerSnapshot = await getDocs(ownerQuery);
  
  //     if (!ownerSnapshot.empty) {
  //       const ownerDoc = ownerSnapshot.docs[0];
  //       const ownerData = ownerDoc.data();
  //       const apartmentId = ownerDoc.ref.parent?.parent?.id;
  
  //       return {
  //         userData: ownerData,
  //         role: ownerData['role'] || 'FlatOwner',
  //         apartmentId: apartmentId || undefined
  //       };
  //     }
  //   } catch (error) {
  //     console.error('Error querying flat owners:', error);
  //   }
  
  
  //   // No match found
  //   return null;
  // }
  
  async getOtpApiKey(): Promise<string> {
    try {
      const docRef = doc(this.firestore, 'appConfig/otpConfig');
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        return snap.data()['apiKey'];
      } else {
        throw new Error('OTP API key not found in Firestore');
      }
    } catch (error) {
      console.error('Error fetching OTP API key:', error);
      throw error;
    }
  }
  
  async getAdminByPhone(phone: string) {
    const adminsRef = collection(this.firestore, 'admins');
    const q = query(adminsRef, where('phone', '==', phone));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data(); // return first match
    } else {
      return null;
    }
  }

  // 📥 Get all Admins
  getAllAdmins(): Observable<AdminUser[]> {
    const adminsRef = collection(this.firestore, 'admins');
    return collectionData(adminsRef, { idField: 'id' }) as Observable<AdminUser[]>;
  }

  async getAdminDetails(uid: string): Promise<DocumentData | null> {
    const adminRef = doc(this.firestore, `admins/${uid}`);
    const adminSnap = await getDoc(adminRef);
    return adminSnap.exists() ? adminSnap.data() : null;
  }

  // ➕ Add new Admin
  addAdmin(admin: AdminUser): Promise<void> {
    const adminsRef = collection(this.firestore, 'admins');
    return addDoc(adminsRef, admin).then(() => {});
  }

  // ❌ Delete Admin
  deleteAdmin(id: string): Promise<void> {
    const adminDocRef = doc(this.firestore, `admins/${id}`);
    return deleteDoc(adminDocRef);
  }

  // 📥 Get all service requests
  getAllServiceRequests(): Observable<ServiceRequest[]> {
    const requestsRef = collection(this.firestore, 'adminRequests');
    return collectionData(requestsRef, { idField: 'id' }) as Observable<ServiceRequest[]>;
  }

  // ✅ Delete a service request
  deleteServiceRequest(id: string): Promise<void> {
    const requestDocRef = doc(this.firestore, `adminRequests/${id}`);
    return deleteDoc(requestDocRef);
  }

  submitAdminQuery(queryData: AdminQuery) {
    const queriesRef = collection(this.firestore, 'adminQueries');
    return addDoc(queriesRef, queryData);
  }
  
  getAdminQueries(apartment: string, adminPhone: string) {
    const queriesRef = collection(this.firestore, 'adminQueries');
    const q = query(queriesRef, where('apartment', '==', apartment), where('adminPhone', '==', adminPhone));
    return getDocs(q);
  }
  
  getAllAdminQueries() {
    const queriesRef = collection(this.firestore, 'adminQueries');
    return getDocs(queriesRef);
  }
  
  resolveAdminQuery(queryId: string) {
    const queryDocRef = doc(this.firestore, 'adminQueries', queryId);
    return updateDoc(queryDocRef, { status: 'Resolved' });
  }

  deleteAdminQuery(id: string) {
    const docRef = doc(this.firestore, 'adminQueries', id);
    return deleteDoc(docRef);
  }

  getFirestore() {
    return this.firestore;
  }

  async getUserDetails(apartment: string, phone: string): Promise<{ name: string, role: string } | null> {
        const adminsRef = collection(this.firestore, 'admins');
        const adminQuery = query(adminsRef, where('apartment', '==', apartment), where('phone', '==', phone));
        const adminSnap = await getDocs(adminQuery);

        if (!adminSnap.empty) {
            const data = adminSnap.docs[0].data();
            return { name: data['name'], role: 'admin' };

        }

        const superRef = collection(this.firestore, 'superadmins'); // adjust if collection name is different
        const superQuery = query(superRef, where('phone', '==', phone));
        const superSnap = await getDocs(superQuery);

        if (!superSnap.empty) {
            const data = superSnap.docs[0].data();
            return { name: data['name'], role: 'superadmin' };
        }

        return null;
    }

    async getContactRequests(): Promise<any[]> {
        const colRef = collection(this.firestore, 'contactRequests') as CollectionReference<DocumentData>;
        const snapshot = await getDocs(colRef);
        return snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
      }
    
      deleteContactRequest(id: string): Promise<void> {
        const docRef = doc(this.firestore, 'contactRequests', id);
        return deleteDoc(docRef);
      }

      // async setPinForDevice(apartmentId: string, userType: 'admins' | 'flatOwners' | 'securityUsers', userId: string, deviceId: string, pin: string) {
      //   const path = `apartments/${apartmentId}/${userType}/${userId}/trustedDevices/${deviceId}`;
      //   await setDoc(doc(this.firestore, path), {
      //     pin,
      //     faceIdEnabled: false,
      //     createdAt: new Date()
      //   }, { merge: true });
      // }

      async verifyPinForDevice(
        apartmentId: string,
        userType: 'admins' | 'flatOwners' | 'securityUsers',
        userId: string,
        deviceId: string,
        pin: string
      ): Promise<boolean> {
        const path = `apartments/${apartmentId}/${userType}/${userId}/trustedDevices/${deviceId}`;
        const ref = doc(this.firestore, path);
        const snap = await getDoc(ref);
        return snap.exists() && snap.data()?.['pin'] === pin;
      }

      async setPinForDevice(
        apartmentId: string,
        userType: UserType,
        userId: string,
        deviceId: string,
        pin: string,
        faceIdEnabled = false
      ) {
        let path: string;
      
        if (userType === 'superadmin') {
          path = `superadmin/${userId}/trustedDevices/${deviceId}`;
        } else {
          path = `apartments/${apartmentId}/${userType}/${userId}/trustedDevices/${deviceId}`;
        }
      
        await setDoc(doc(this.firestore, path), {
          pin,
          faceIdEnabled,
          createdAt: new Date()
        }, { merge: true });
      }
      
      
      async getTrustedDeviceInfo(
        apartmentId: string | null,
        userType: 'admins' | 'flatOwners' | 'securityUsers' | 'superadmin',
        userId: string,
        deviceId: string
      ): Promise<{ pin?: string; faceIdEnabled?: boolean } | null> {
        try {
          let path: string;
      
          if (userType === 'superadmin') {
            // Global-level trusted device storage for superadmin
            path = `superadmin/${userId}/trustedDevices/${deviceId}`;
          } else {
            if (!apartmentId) {
              console.warn('Missing apartmentId for non-superadmin user');
              return null;
            }
            path = `apartments/${apartmentId}/${userType}/${userId}/trustedDevices/${deviceId}`;
          }
      
          const docRef = doc(this.firestore, path);
          const snap = await getDoc(docRef);
      
          if (snap.exists()) {
            return snap.data() as { pin?: string; faceIdEnabled?: boolean };
          }
          return null;
        } catch (error) {
          console.error('Error fetching trusted device info:', error);
          return null;
        }
      }

      async updateApartmentPlan(apartmentId: string, plan: string): Promise<void> {
        const apartmentDocRef = doc(this.firestore, `apartments/${apartmentId}`);
        await updateDoc(apartmentDocRef, {
          plan: plan,
          trialExpiry: null
        });
      }


      //getFlatOwners(apartmentId: string) {
      //   const colRef = collection(this.firestore, `apartments/${apartmentId}/flatOwners`) as CollectionReference<DocumentData>;
      //   return getDocs(colRef).then(snapshot => 
      //     snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
      //   );
      // }
    
      // async addFlatOwner(
      //   apartmentId: string,
      //   owner: { name: string; phone: string; flat: string },
      //   role: string
      // ): Promise<void> {
      //   const flatOwnersRef = collection(this.firestore, 'apartments', apartmentId, 'flatOwners');
      
      //   // Check if flat owner with same phone number already exists
      //   const existingOwnerSnap = await getDocs(query(flatOwnersRef, where('phone', '==', owner.phone)));
      //   if (!existingOwnerSnap.empty) {
      //     throw new Error('A flat owner with this phone number already exists.');
      //   }
      
      //   await addDoc(flatOwnersRef, {
      //     name: owner.name,
      //     phone: owner.phone,
      //     flat: owner.flat,
      //     role: role,
      //     createdAt: serverTimestamp()
      //   });
      // }
      
      async getApartmentIdByName(apartmentName: string): Promise<string | null> {
        const snapshot = await getDocs(query(collection(this.firestore, 'apartments'), where('name', '==', apartmentName)));
        if (!snapshot.empty) {
          return snapshot.docs[0].id;
        }
        return null;
      }
      
      
      // updateFlatOwner(apartmentId: string, ownerId: string, data: any) {
      //   const docRef = doc(this.firestore, `apartments/${apartmentId}/flatOwners`, ownerId);
      //   return updateDoc(docRef, data);
      // }
    
      // deleteFlatOwner(apartmentId: string, ownerId: string) {
      //   const docRef = doc(this.firestore, `apartments/${apartmentId}/flatOwners`, ownerId);
      //   return deleteDoc(docRef);
      // }

      // async findFlatOwnerByPhone(phone: string): Promise<{
      //   apartmentId: string;
      //   ownerData: DocumentData;
      // } | null> {
      //  // const apartmentId = 'Geetika Pride';
      //   const flatOwnersRef = collection(this.firestore, `apartments/${apartmentId}/flatOwners`);
      
      //   const trimmedPhone = phone.trim();
      //   console.log(`Looking for phone '${trimmedPhone}' in ${apartmentId}`);
      
      //   const ownerQuery = query(flatOwnersRef, where('phone', '==', trimmedPhone));
      //   const ownerSnapshot = await getDocs(ownerQuery);
      
      //   console.log(`Found ${ownerSnapshot.size} matches`);
      
      //   if (!ownerSnapshot.empty) {
      //     const ownerData = ownerSnapshot.docs[0].data();
      //     console.log('Match found:', ownerData);
      //     return {
      //       apartmentId,
      //       ownerData
      //     };
      //   }
      
      //   console.log('No match found');
      //   return null;
      // }
      
      // async addApartmentAdmin(
      //   adminName: string,
      //   phoneNumber: string,
      //   apartmentName: string,
      //   adminRole: string, // Add adminRole parameter
      //   flatOwnerRole?: string // Optional flatOwnerRole parameter
      // ): Promise<string> { // Return the document ID as a string
      //   try {
      //     // Assuming you want to create a top-level document in the 'apartments' collection
      //     const colRef = collection(this.firestore, 'apartments');
      //     const docRef = await addDoc(colRef, {
      //       adminName: adminName,
      //       phoneNumber: phoneNumber,
      //       apartmentName: apartmentName,
      //       adminRole: adminRole, // Store the admin role
      //       flatOwnerRole: flatOwnerRole || null, // Store the flat owner role (or null if not applicable)
      //       creationDate: new Date()
      //       // Add any other relevant fields here
      //     });
      //     const newAdminId = docRef.id; // Access the ID from the DocumentReference
      //     console.log('Document written with ID: ', newAdminId);
      //     return newAdminId; // Return the ID
      //   } catch (e) {
      //     console.error('Error adding document: ', e);
      //     throw e; // Re-throw the error for the component to handle
      //   }
      // }

      // async addApartmentAdmin(
      //   adminName: string,
      //   phoneNumber: string,
      //   apartmentId: string,        // now expecting apartment ID
      //   adminRole: string,
      //   flatOwnerRole?: string
      // ): Promise<string> {
      //   const db = this.firestore;
      
      //   // Step 1: Fetch apartment document to get its name
      //   const apartmentDoc = await getDoc(doc(db, 'apartments', apartmentId));
      //   if (!apartmentDoc.exists()) throw new Error(`Apartment with ID "${apartmentId}" not found.`);
      //   const apartmentName = apartmentDoc.data()['name'];
      
      //   const adminsRef = collection(db, 'apartments', apartmentId, 'admins');
      
      //   // Step 2: Prevent duplicate admin by phone number
      //   const existingAdminSnap = await getDocs(query(adminsRef, where('phoneNumber', '==', phoneNumber)));
      //   if (!existingAdminSnap.empty) throw new Error('An admin with this phone number already exists.');
      
      //   // Step 3: Check if the person is a flat owner
      //   const flatOwnerRef = collection(db, 'apartments', apartmentId, 'flatOwners');
      //   const flatOwnerSnap = await getDocs(query(flatOwnerRef, where('phoneNumber', '==', phoneNumber)));
      
      //   let flatOwnerId: string | null = null;
      
      //   if (!flatOwnerSnap.empty) {
      //     // Found existing flat owner
      //     flatOwnerId = flatOwnerSnap.docs[0].id;
      
      //     // Step 4: Update flat owner's role
      //     if (flatOwnerRole) {
      //       await updateDoc(doc(db, 'apartments', apartmentId, 'flatOwners', flatOwnerId), {
      //         role: flatOwnerRole,
      //         updatedAt: serverTimestamp()
      //       });
      //     }
      //   } else if (flatOwnerRole) {
      //     // No flat owner exists, so create one
      //     const newFlatOwnerRef = await addDoc(flatOwnerRef, {
      //       name: adminName,
      //       phoneNumber,
      //       role: flatOwnerRole,
      //       createdAt: serverTimestamp()
      //     });
      //     flatOwnerId = newFlatOwnerRef.id;
      //   }
      
      //   // Step 5: Create the admin
      //   const newAdminRef = await addDoc(adminsRef, {
      //     adminName,
      //     phoneNumber,
      //     adminRole,
      //     flatOwnerId: flatOwnerId || null,
      //     apartmentName, // Store for easy display
      //     creationDate: serverTimestamp()
      //   });
      
      //   return newAdminRef.id;
      // }
      
      async addApartmentAdmin(
        adminName: string,
        phoneNumber: string,
        apartmentId: string,
        adminRole: string,
        flatOwnerRole?: string,
        flatNumber?: string | null
      ): Promise<string> {
        const db = this.firestore;
      
        // Step 1: Fetch apartment document to get its name
        const apartmentDoc = await getDoc(doc(db, 'apartments', apartmentId));
        if (!apartmentDoc.exists()) throw new Error(`Apartment with ID "${apartmentId}" not found.`);
        const apartmentName = apartmentDoc.data()['name'];
      
        const adminsRef = collection(db, 'apartments', apartmentId, 'admins');
      
        // Step 2: Prevent duplicate admin by phone number
        const existingAdminSnap = await getDocs(query(adminsRef, where('phoneNumber', '==', phoneNumber)));
        if (!existingAdminSnap.empty) throw new Error('An admin with this phone number already exists.');
      
        // Step 3: Check if the person is a flat owner
        const flatOwnerRef = collection(db, 'apartments', apartmentId, 'flatOwners');
        const flatOwnerSnap = await getDocs(query(flatOwnerRef, where('phoneNumber', '==', phoneNumber)));
      
        let flatOwnerId: string | null = null;
      
        if (!flatOwnerSnap.empty) {
          // Found existing flat owner
          flatOwnerId = flatOwnerSnap.docs[0].id;
      
          // Step 4: Update flat owner's role and flat number
          if (flatOwnerRole || flatNumber) {
            const updateData: any = { updatedAt: serverTimestamp() };
            if (flatOwnerRole) updateData.role = flatOwnerRole;
            if (flatNumber) updateData.flat = flatNumber;
      
            await updateDoc(doc(db, 'apartments', apartmentId, 'flatOwners', flatOwnerId), updateData);
          }
        } else if (flatOwnerRole) {
          // No flat owner exists, so create one
          const newFlatOwnerRef = await addDoc(flatOwnerRef, {
            name: adminName,
            phoneNumber,
            role: flatOwnerRole,
            flat: flatNumber || '',
            createdAt: serverTimestamp()
          });
          flatOwnerId = newFlatOwnerRef.id;
        }
      
        // Step 5: Create the admin
        const newAdminRef = await addDoc(adminsRef, {
          adminName,
          phoneNumber,
          adminRole,
          flatOwnerId: flatOwnerId || null,
          apartmentName,
          flatNumber: flatNumber || '',
          creationDate: serverTimestamp()
        });
      
        return newAdminRef.id;
      }
      


      // async updateAdmin(apartmentName: string, adminId: string, updatedData: any): Promise<void> {
      //   const db = this.firestore;
      
      //   // Find the apartment by name
      //   const apartmentSnapshot = await getDocs(query(collection(db, 'apartments'), where('name', '==', apartmentName)));
      //   if (apartmentSnapshot.empty) {
      //     throw new Error(`Apartment "${apartmentName}" not found.`);
      //   }
      
      //   const apartmentId = apartmentSnapshot.docs[0].id;
      //   const adminRef = doc(db, 'apartments', apartmentId, 'admins', adminId);
      
      //   await updateDoc(adminRef, {
      //     adminName: updatedData.adminName,
      //     phoneNumber: updatedData.phoneNumber,
      //     adminRole: updatedData.adminRole,
      //     creationDate: serverTimestamp(), // optional: update timestamp
      //   });
      
      //   // Optionally update flatOwnerRole if a flatOwnerId exists
      //   if (updatedData.flatOwnerId && updatedData.flatOwnerRole) {
      //     const flatOwnerRef = doc(db, 'apartments', apartmentId, 'flatOwners', updatedData.flatOwnerId);
      //     await updateDoc(flatOwnerRef, { role: updatedData.flatOwnerRole });
      //   }
      // }

      async updateAdmin(apartmentId: string, adminId: string, updatedData: any): Promise<void> {
        const db = this.firestore;
      
        // Directly use apartmentId (more reliable than searching by name)
        const adminRef = doc(db, 'apartments', apartmentId, 'admins', adminId);
      
        // Prepare admin data update
        const adminUpdate: any = {
          adminName: updatedData.adminName,
          phoneNumber: updatedData.phoneNumber,
          adminRole: updatedData.adminRole,
          flatNumber: updatedData.flatNumber || null,
          creationDate: serverTimestamp() // optional: last updated
        };
      
        await updateDoc(adminRef, adminUpdate);
      
        // Update flat owner role if needed
        if (updatedData.flatOwnerId && updatedData.flatOwnerRole) {
          const flatOwnerRef = doc(db, 'apartments', apartmentId, 'flatOwners', updatedData.flatOwnerId);
          await updateDoc(flatOwnerRef, {
            role: updatedData.flatOwnerRole,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      // async removeAdmin(apartmentName: string, adminId: string): Promise<void> {
      //   const db = this.firestore;
      
      //   const apartmentSnapshot = await getDocs(query(collection(db, 'apartments'), where('name', '==', apartmentName)));
      //   if (apartmentSnapshot.empty) {
      //     throw new Error(`Apartment "${apartmentName}" not found.`);
      //   }
      
      //   const apartmentId = apartmentSnapshot.docs[0].id;
      //   const adminRef = doc(db, 'apartments', apartmentId, 'admins', adminId);
      //   await deleteDoc(adminRef);
      // }
      
      async removeAdmin(apartmentName: string, adminId: string): Promise<void> {
        const db = this.firestore;
      
        // Fetch apartment document
        const apartmentSnapshot = await getDocs(query(collection(db, 'apartments'), where('name', '==', apartmentName)));
        if (apartmentSnapshot.empty) {
          throw new Error(`Apartment "${apartmentName}" not found.`);
        }
      
        const apartmentId = apartmentSnapshot.docs[0].id;
        
        // Get the admin reference and delete it
        const adminRef = doc(db, 'apartments', apartmentId, 'admins', adminId);
        await deleteDoc(adminRef);
      
        // Fetch all flat owners associated with the apartment
        const flatOwnersSnapshot = await getDocs(collection(db, 'apartments', apartmentId, 'flatOwners'));
        
        // Delete all associated flat owners
        const deletePromises = flatOwnersSnapshot.docs.map(flatOwnerDoc => {
          return deleteDoc(doc(db, 'apartments', apartmentId, 'flatOwners', flatOwnerDoc.id));
        });
      
        // Wait for all flat owners to be deleted
        await Promise.all(deletePromises);
      }
      
      
      
      async editApartmentAdmin(adminId: string, updatedData: any): Promise<void> {
        try {
          const adminDocRef = doc(this.firestore, 'apartments', adminId);
          await updateDoc(adminDocRef, updatedData);
          console.log(`Admin with ID ${adminId} updated successfully.`);
        } catch (error) {
          console.error(`Error updating admin with ID ${adminId}:`, error);
          throw error; // Re-throw the error for the component to handle
        }
      }

      async getApartmentAdmins(): Promise<any[]> {
        try {
          const admins: any[] = [];
          const apartmentsCollection = collection(this.firestore, 'apartments');
          const querySnapshot = await getDocs(query(apartmentsCollection)); // Get all documents
    
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data['creationDate'] && data['creationDate'] instanceof Timestamp) {
              data['creationDate'] = data['creationDate'].toDate();
            }
            admins.push({ id: doc.id, ...data }); // Push the document data *with* the ID
          });
    
          return admins;
        } catch (error) {
          console.error('Error fetching admins:', error);
          return []; // Return an empty array in case of an error
        }
      }

      async loadAllAdmins(): Promise<any[]> {
        const db = this.firestore;
        const apartmentsSnapshot = await getDocs(collection(db, 'apartments'));
        const admins: any[] = [];
      
        for (const apartmentDoc of apartmentsSnapshot.docs) {
          const apartmentId = apartmentDoc.id;
          const apartmentData = apartmentDoc.data();
          const apartmentName = apartmentData['name'];
          const locked = apartmentData['locked'] || false;                  
          const lockedReason = apartmentData['lockedReason'] || null;      
      
          const adminsSnapshot = await getDocs(collection(db, 'apartments', apartmentId, 'admins'));
      
          for (const adminDoc of adminsSnapshot.docs) {
            const adminData = adminDoc.data();
      
            // ✅ Only include approved admins
            if (!adminData['approved']) continue;
      
            let flatOwnerRole = null;
      
            if (adminData['flatOwnerId']) {
              const flatOwnerDoc = await getDoc(
                doc(db, 'apartments', apartmentId, 'flatOwners', adminData['flatOwnerId'])
              );
              if (flatOwnerDoc.exists()) {
                const flatOwnerData = flatOwnerDoc.data();
                flatOwnerRole = flatOwnerData['role'] || null;
              }
            }
      
            admins.push({
              id: adminDoc.id,
              adminName: adminData['adminName'],
              phoneNumber: adminData['phoneNumber'],
              adminRole: adminData['adminRole'],
              apartmentId: apartmentId, // ✅ Include apartmentId
              apartmentName: apartmentName,
              creationDate: adminData['creationDate']?.toDate?.() ?? new Date(adminData['creationDate']),
              flatOwnerRole,
              locked,
              lockedReason
            });
          }
        }
      
        return admins;
      }
      
      
      
      async isAdminPhoneUsed(apartmentName: string, phoneNumber: string): Promise<boolean> {
        const apartmentAdminsRef = collection(this.firestore, 'apartment_admins');
        const q = query(
          apartmentAdminsRef,
          where('apartmentName', '==', apartmentName.trim()),
          where('phoneNumber', '==', phoneNumber.trim())
        );
    
        const snapshot = await getDocs(q);  // Execute the query
        return !snapshot.empty;  // If snapshot is empty, phone number is not in use
      }

      // Method to add a new apartment to the 'apartments' collection
      async addApartment(apartment: { name: string }): Promise<string> {
        try {
          // Reference to the apartments collection
          const apartmentsRef = collection(this.firestore, 'apartments');

          // Add a new document to the apartments collection
          const docRef = await addDoc(apartmentsRef, {
            name: apartment.name,
          });

          // Return the ID of the newly added apartment document
          return docRef.id;
        } catch (error) {
          console.error('Error adding apartment: ', error);
          throw new Error('Failed to add apartment');
        }
      }

    // Method to get all apartments
   // Method to get all apartments
  async getApartments(): Promise<Apartment[]> {  // Specify the return type as Apartment[]
    try {
      const apartmentsRef = collection(this.firestore, 'apartments');
      const snapshot = await getDocs(apartmentsRef);
      const apartments = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data()['name']
      }));
      return apartments;
    } catch (error) {
      console.error('Error getting apartments:', error);
      throw new Error('Error fetching apartments');
    }
  }

  addFlatOwner(apartmentId: string, owner: any) {
    const colRef = collection(this.firestore, `apartments/${apartmentId}/flatOwners`);
    return addDoc(colRef, owner);
  }

 // ✅ Update flatOwner and userIndex if phone number has changed
updateFlatOwner(apartmentId: string, ownerId: string, updatedData: any, oldPhoneNumber?: string) {
  const ownerDocRef = doc(this.firestore, `apartments/${apartmentId}/flatOwners/${ownerId}`);
  const batch = writeBatch(this.firestore);

  // Update flat owner document
  batch.update(ownerDocRef, updatedData);

  // If phone number changed, update userIndex:
  if (oldPhoneNumber && oldPhoneNumber !== updatedData.phoneNumber) {
    const oldIndexRef = doc(this.firestore, `userIndex/${oldPhoneNumber}`);
    const newIndexRef = doc(this.firestore, `userIndex/${updatedData.phoneNumber}`);

    batch.delete(oldIndexRef);
    batch.set(newIndexRef, {
      apartmentId,
      apartmentName: updatedData.apartmentName || '',
      flat: updatedData.flat || '',
      name: updatedData.name,
      phoneNumber: updatedData.phoneNumber,
      role: updatedData.role,
      source: 'flatOwners',
      userType: updatedData.role
    });
  }

  return batch.commit();
}
  
  
deleteFlatOwner(apartmentId: string, ownerId: string, phoneNumber: string) {
  const ownerDocRef = doc(this.firestore, `apartments/${apartmentId}/flatOwners/${ownerId}`);
  const userIndexRef = doc(this.firestore, `userIndex/${phoneNumber}`);

  const batch = writeBatch(this.firestore);
  batch.delete(ownerDocRef);
  batch.delete(userIndexRef);

  return batch.commit();
}
  

  getFlatOwners(apartmentId: string): Observable<any[]> {
    const colRef = collection(this.firestore, `apartments/${apartmentId}/flatOwners`);
    return from(getDocs(colRef)).pipe(
      map((snapshot: QuerySnapshot<DocumentData, DocumentData>) =>
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      )
    );
  }

  async getDocument<T = DocumentData>(path: string): Promise<T | null> {
    const docRef: DocumentReference = doc(this.firestore, path);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as T) : null;
  }

  updateDocument(path: string, data: any): Promise<void> {
    const ref = doc(this.firestore, path);
    return updateDoc(ref, data);
  }

  // async getApartmentDetailsByAdminPhoneNumber(adminPhoneNumber: string): Promise<{ apartmentId: string | null, apartmentName: string | null }> {
  //   try {
  //     const apartmentsRef = collection(this.firestore, 'apartments');
  //     const adminsCollectionGroup = collectionGroup(this.firestore, 'admins');
  //     const q = query(adminsCollectionGroup, where('phoneNumber', '==', adminPhoneNumber));
  //     const querySnapshot = await getDocs(q);
  
  //     if (!querySnapshot.empty) {
  //       // Assuming the phoneNumber is unique for an admin
  //       const adminDoc = querySnapshot.docs[0];
  //       // The apartment document is the parent of the 'admins' subcollection
  //       const apartmentDocRef = adminDoc.ref.parent?.parent;
  //       if (apartmentDocRef) {
  //         const apartmentSnapshot = await getDoc(apartmentDocRef);
  //         if (apartmentSnapshot.exists()) {
  //           const apartmentData = apartmentSnapshot.data();
  //           const apartmentId = apartmentDocRef.id;  // Get the apartment document ID
  //           const apartmentName = apartmentData ? apartmentData['name'] : null;  // Get apartment name
  //           return { apartmentId, apartmentName };  // Return both apartmentId and apartmentName
  //         }
  //       }
  //     }
  //     return { apartmentId: null, apartmentName: null };  // If not found
  //   } catch (error) {
  //     console.error('Error fetching apartment details:', error);
  //     return { apartmentId: null, apartmentName: null };  // Return null in case of error
  //   }
  // }
  
  async getApartmentDetailsByAdminPhoneNumber(adminPhoneNumber: string): Promise<{
    apartmentId: string | null,
    apartmentName: string | null,
    adminFlatOwnerId: string | null,
    adminName: string | null
  }> {
    try {
      const adminsCollectionGroup = collectionGroup(this.firestore, 'admins');
      const q = query(adminsCollectionGroup, where('phoneNumber', '==', adminPhoneNumber));
      const querySnapshot = await getDocs(q);
  
      if (!querySnapshot.empty) {
        const adminDoc = querySnapshot.docs[0];
        const adminData = adminDoc.data();
  
        const apartmentDocRef = adminDoc.ref.parent?.parent;
        if (apartmentDocRef) {
          const apartmentSnapshot = await getDoc(apartmentDocRef);
          if (apartmentSnapshot.exists()) {
            const apartmentData = apartmentSnapshot.data();
            const apartmentId = apartmentDocRef.id;
            const apartmentName = apartmentData ? apartmentData['name'] : null;
  
            const adminFlatOwnerId = adminData?.['flatOwnerId'] ?? null;
            const adminName = adminData?.['adminName'] ?? null;
  
            return { apartmentId, apartmentName, adminFlatOwnerId,adminName };
          }
        }
      }
  
      return { apartmentId: null, apartmentName: null, adminFlatOwnerId: null , adminName: null};
    } catch (error) {
      console.error('Error fetching apartment details:', error);
      return { apartmentId: null, apartmentName: null, adminFlatOwnerId: null , adminName: null};
    }
  }
  
  async updateOwnerPaymentStatus(
    apartmentId: string,
    expenseId: string,
    ownerId: string,
    newStatus: boolean
  ): Promise<void> {
    const expenseRef = doc(this.firestore, `apartments/${apartmentId}/expenses/${expenseId}`);
    const expenseSnap = await getDoc(expenseRef);
  
    if (!expenseSnap.exists()) {
      throw new Error('Expense document does not exist');
    }
  
    const data = expenseSnap.data();
  
    if (!data['flatOwners'] || typeof data['flatOwners'] !== 'object') {
      throw new Error('flatOwners is not a valid object');
    }
  
    // Update the specific owner's paid status
    const updatedFlatOwners = { ...data['flatOwners'] };
    if (!updatedFlatOwners[ownerId]) {
      throw new Error('Owner not found in flatOwners');
    }
  
    updatedFlatOwners[ownerId] = {
      ...updatedFlatOwners[ownerId],
      paid: newStatus
    };
  
    await updateDoc(expenseRef, { flatOwners: updatedFlatOwners });
  }
  async togglePaidStatus(apartmentId: string, ownerId: string, expenseId: string, month: string) {
    const monthlyRef = doc(this.firestore, `apartments/${apartmentId}/flatOwners/${ownerId}/monthlyExpenses/${month}`);
    const snap = await getDoc(monthlyRef);
    if (!snap.exists()) return;
  
    const data = snap.data();
    const items = (data['items'] || []).map((item: any) => {
      if (item.expenseId === expenseId) {
        item.paid = !item.paid;
      }
      return item;
    });
  
    await updateDoc(monthlyRef, { items });
  }
  
  async postAnnouncement(apartmentId: string, announcement: any) {
    const collectionRef = collection(this.getFirestore(), `apartments/${apartmentId}/announcements`);
    const newDocRef = doc(collectionRef); // auto-ID
    await setDoc(newDocRef, {
      id: newDocRef.id,
      ...announcement
    });
  }
  

  getAnnouncements(apartmentId: string) {
    const announcementsRef = collection(this.firestore, `apartments/${apartmentId}/announcements`);
    const q = query(announcementsRef, orderBy('postedAt', 'desc'));
    return collectionData(q, { idField: 'id' });
  }
   
  // Save RSVP for a flat owner
  saveRSVP(apartmentId: string, announcementId: string, flatOwnerId: string, data: any) {
    const rsvpRef = doc(this.firestore, `apartments/${apartmentId}/announcements/${announcementId}/rsvps/${flatOwnerId}`);
    return setDoc(rsvpRef, data);
  }

// Get all RSVPs for an announcement (admin view)
getRSVPs(apartmentId: string, announcementId: string) {
  const rsvpsRef = collection(this.firestore, `apartments/${apartmentId}/announcements/${announcementId}/rsvps`);
  const q = query(rsvpsRef, orderBy('respondedAt', 'desc'));
  return collectionData(q, { idField: 'id' });
}

async getFlatOwnersList(): Promise<FlatOwner[]> {
  try {
    const flatOwnersSnapshot = await getDocs(collectionGroup(this.firestore, 'flatOwners'));
    return flatOwnersSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data()?.['name'] as string,
      flat: doc.data()?.['flat'] as string,
      phoneNumber: doc.data()?.['phoneNumber'] as string,
      role: (doc.data()?.['role'] || 'resident') as 'resident' | 'admin',
    }));
  } catch (error) {
    console.error('Error fetching flat owners:', error);
    return [];
  }
}

// Corrected method to update flat owner role
async updateFlatOwnerRole(flatOwnerId: string, newRole: 'resident' | 'admin'): Promise<void> {
  try {
    // Get all flatOwner documents from all apartments
    const q = query(collectionGroup(this.firestore, 'flatOwners'), limit(50)); // broader query
    const querySnapshot = await getDocs(q);

    // Manually find the correct document by ID
    const docMatch = querySnapshot.docs.find(doc => doc.id === flatOwnerId);
    if (!docMatch) {
      throw new Error(`Flat owner with ID ${flatOwnerId} not found across all apartments.`);
    }

    const flatOwnerDocRef = docMatch.ref;

    // Update role
    await updateDoc(flatOwnerDocRef, { role: newRole });
    console.log(`✅ Flat owner ${flatOwnerId} updated to role: ${newRole}`);
  } catch (error) {
    console.error(`❌ Error updating role for flat owner ${flatOwnerId}:`, error);
    throw error;
  }
}

async checkIfApartmentExists(name: string): Promise<boolean> {
  const apartmentsRef = collection(this.firestore, 'apartments');
  const q = query(apartmentsRef, where('name', '==', name));
  const snapshot = await getDocs(q);
  return !snapshot.empty; 
}
addCalendarEvent(apartmentId: string, event: any) {
  const eventRef = collection(this.firestore, `apartments/${apartmentId}/calendarEvents`);
  return addDoc(eventRef, event);
}

getCalendarEvents(apartmentId: string) {
  const eventRef = collection(this.firestore, `apartments/${apartmentId}/calendarEvents`);
  return collectionData(eventRef, { idField: 'id' }) as Observable<any[]>;
}
getMarketplaceItems(apartmentId: string): Observable<any[]> {
  const itemsRef = collection(this.firestore, `apartments/${apartmentId}/marketplace`);
  return from(getDocs(itemsRef).then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
}

async setUserIndex(entry: UserIndexEntry): Promise<void> {
  const firestore = this.getFirestore();
  const indexRef = doc(firestore, 'userIndex', entry.phoneNumber);
  await setDoc(indexRef, entry);
}


async getUserByPhoneNumber(
  phoneNumber: string
): Promise<{ userData: any; role: ExtendedRole; apartmentId?: string, flatOwnerId?: string; } | null> {
  // 🔍 Step 1: Lookup in userIndex
  const userIndexRef = doc(this.firestore, 'userIndex', phoneNumber);
  const indexSnap = await getDoc(userIndexRef);

  if (!indexSnap.exists()) return null;

  const indexData = indexSnap.data();
  const role = indexData['role'] as ExtendedRole;
  const apartmentId = indexData['apartmentId'] || null;
  const source = indexData['source']; // 'flatOwners', 'admins', 'securityUsers', 'superadmin'

  // 🔐 Handle SuperAdmin (not tied to apartment)
  if (source === 'superadmin') {
    const superAdminRef = collection(this.firestore, 'superadmin');
    const q = query(superAdminRef, where('phone', '==', phoneNumber));
    const snapshot = await getDocs(q);
  
    if (snapshot.empty) return null;
    const docSnap = snapshot.docs[0];
    const superAdminData = snapshot.docs[0].data();
    return {
      userData: {
        ...superAdminData,
        flat: '',
        apartmentName: '',
        phone: phoneNumber
      },
      role: 'superadmin',
      flatOwnerId: docSnap.id ,
    };
  }

  // ❌ Abort if apartment-based data missing
  if (!apartmentId || !source) return null;

  // 🔄 Query apartment subcollection
  const userCollectionRef = collection(this.firestore, `apartments/${apartmentId}/${source}`);
  const userQuery = query(userCollectionRef, where('phoneNumber', '==', phoneNumber));
  const querySnap = await getDocs(userQuery);

  if (querySnap.empty) return null;

  const userSnap = querySnap.docs[0];
  const userData = userSnap.data();
  const flatOwnerId = userSnap.id;
  // 👩‍❤️‍👨 Handle spouse login case
  if (
    source === 'flatOwners' &&
    userData?.['spouse']?.phoneNumber === phoneNumber &&
    userData['spouse']?.['accessEnabled']
  ) {
    return {
      userData: {
        ...userData['spouse'],
        flat: userData['flat'],
        flatOwnerName: userData['name'],
        apartmentName: indexData['apartmentName']
      },
      role: 'resident',
      apartmentId,
      flatOwnerId
    };
  }

  // ✅ Normal return (flatOwner, admin, security)
  return {
    userData: {
      ...userData,
      apartmentName: indexData['apartmentName'] || '',
      flat: userData['flat'] || '',
      phone: userData['phoneNumber'] || phoneNumber
    },
    role,
    apartmentId,
    flatOwnerId
  };
}


async updateUserIndex(
  phone: string,
  role: UserIndexEntry['role'],
  userType: UserIndexEntry['userType'],
  apartmentId?: string,
  flatOwnerId?: string,
  apartmentName?: string,
  flat?: string,
  sqft?: number,
  name?: string
): Promise<void> {
  const indexRef = doc(this.firestore, 'userIndex', phone);

  // Prepare base fields
  const indexData: any = {
    phoneNumber: phone,
    role,
    userType,
    source:
      userType === 'admin'
        ? 'admins'
        : userType === 'security'
        ? 'securityUsers'
        : userType === 'superadmin'
        ? 'superadmin'
        : 'flatOwners',
    apartmentId,
    apartmentName: apartmentName ?? '',
    flat: flat ?? '',
    name: name ?? ''
  };

  // Add optional field only if defined
  if (flatOwnerId) {
    indexData.flatOwnerId = flatOwnerId;
  }
  if (typeof sqft === 'number') {
    indexData.sqft = sqft;
  }

  await setDoc(indexRef, indexData, { merge: true });
}

async clearPin(apartmentId: string, userType: string, userId: string, deviceId: string): Promise<void> {
  const firestore = this.getFirestore();
  const pinPath = `apartments/${apartmentId}/${userType}/${userId}/trustedDevices/${deviceId}`;
  const pinRef = doc(firestore, pinPath);
  await setDoc(pinRef, { pin: '' }, { merge: true }); // Clears the existing PIN
}

getActivePlans(): Observable<SubscriptionPlan[]> {
  const plansRef = collection(this.firestore, 'subscriptionPlans');
  const q = query(plansRef, where('isActive', '==', true));
  return collectionData(q, { idField: 'id' }) as Observable<SubscriptionPlan[]>;
}

/**security */

async logVisitor(
  apartmentId: string,
  visitor: {
    name: string;
    phone: string;
    purpose: string;
    flat: string;
    time: string | Date;
    source: 'manual' | 'qr';
    used: boolean;
  }
) {
  const logRef = collection(this.firestore, `apartments/${apartmentId}/visitorLogs`);
  await addDoc(logRef, {
    ...visitor,
    time: visitor.time instanceof Date
      ? Timestamp.fromDate(visitor.time)
      : Timestamp.fromDate(new Date(visitor.time)),
    createdAt: new Date()
  });
}

async getVisitorLogs(apartmentId: string): Promise<any[]> {
  const logsRef = collection(this.firestore, `apartments/${apartmentId}/visitorLogs`);
  const snapshot = await getDocs(logsRef);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
exportVisitorLogs(apartmentId: string, format: 'csv' | 'pdf', logs: any[]) {
  if (!logs || logs.length === 0) {
    alert('No visitor logs available to export.');
    return;
  }

  if (format === 'csv') {
    const csv = Papa.unparse(logs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `VisitorLogs-${apartmentId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else if (format === 'pdf') {
    const doc = new jsPDF();
    doc.text(`Visitor Logs - Apartment ${apartmentId}`, 10, 10);

    const tableData = logs.map((log: any) => [
      log.name,
      log.phone,
      log.purpose,
      log.flat,
      new Date(log.time).toLocaleString(),
      log.source
    ]);

    autoTable(doc, {
      head: [['Name', 'Phone', 'Purpose', 'Flat', 'Time', 'Source']],
      body: tableData,
      startY: 20
    });

    doc.save(`VisitorLogs-${apartmentId}.pdf`);
  }
}
async getActiveSubscriptionPlans(): Promise<any[]> {
  const planRef = collection(this.firestore, 'subscriptionPlans');
  const q = query(planRef, orderBy('displayOrder'));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...(doc.data() as any) }))
    .filter(plan => plan.isActive && plan.name !== 'trial');
}

getFlatOwnerIdByPhone(apartmentId: string, phoneNumber: string): Promise<string | null> {
  const colRef = collection(this.firestore, `apartments/${apartmentId}/flatOwners`);
  const q = query(colRef, where('phoneNumber', '==', phoneNumber));

  return getDocs(q)
    .then(snapshot => {
      if (!snapshot.empty) {
        return snapshot.docs[0].id; // flatOwnerId
      }
      return null;
    })
    .catch(error => {
      console.error('Error fetching flatOwnerId by phone:', error);
      return null;
    });
}
async getApartmentById(apartmentId: string): Promise<any> {
  const docRef = doc(this.firestore, `apartments/${apartmentId}`);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}



}

// async updateFlatOwnerRoleByIndex(phoneNumber: string, newRole: ExtendedRole) {
//   const indexDoc = await getDoc(doc(this.firestore, 'userIndex', phoneNumber));
//   if (!indexDoc.exists()) throw new Error('User index not found');

//   const index = indexDoc.data() as UserIndexEntry;
//   if (index.source !== 'flatOwners') throw new Error('User is not a flat owner');

//   const ownerDocRef = doc(this.firestore, `apartments/${index.apartmentId}/flatOwners/${index.flat}`);
//   await updateDoc(ownerDocRef, { role: newRole });
// }


