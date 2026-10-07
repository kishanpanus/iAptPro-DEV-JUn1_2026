export type ExtendedRole = 'admin' | 'owner' | 'resident' | 'superadmin' | 'security';

export interface Apartment {
    id?: string;
    name: string;
    address?: string;
    createdAt?: Date;
  }
  
  // export interface Admin {
  //   id?: string;
  //   name: string;
  //   phone: string;
  //   isActive: boolean;
  //   tenureEnd?: Date;
  //   role: ExtendedRole;
  // }
  
  // export interface FlatOwner {
  //   id?: string;
  //   name: string;
  //   phone: string;
  //   flatNo: string;
  //   isAdmin: boolean;
  // }

  export interface FlatWithReading {
    flatNo: string;
    lastReading: number | null;
    arrears: number | null;
  }
  
  // Updated FlatOwner interface
  export interface FlatOwner {
    id: string;
    name: string;
    flat: string;
    phoneNumber?: string;
    role: 'resident' | 'admin'; 
  }
  
  export interface AdminRequest {
    id?: string;
    type: string;
    message: string;
    status: 'open' | 'resolved';
    createdAt: Date;
    requestedBy: string;
  }
  
  export interface SuperAdminRequest extends AdminRequest {
    apartmentId: string;
    apartmentName: string;
  }

  export interface AdminUser {
    id?: string;
    name: string;
    phone: string;
    apartmentId: string;
    isActive: boolean;
  }

  // models/service-request.ts
// models/service-request.ts
// src/app/models/service-request.ts
export interface ServiceRequest {
  id?: string;
  apartment: string;
  type: string;
  message: string;
  phoneNumber?: string;
  responseMessage?: string;
  status: 'Pending' | 'Resolved';
  timestamp?: number;
}

export interface Admin {
  name: string;
  adminName?: string;
  phone: string;
  role: ExtendedRole;
  apartmentName: string;
  approvalDate: string;
  approvalStatus: string;
  approved: boolean;
  block: string;
  creationDate: string;
  email: string;
  flatNumber: string;
  flatOwnerId: string;
  isActive: boolean;
  userId?: string;
}

export interface Plan {
  name: 'trial' | 'standard' | 'premium' | 'startup';
  title: string;
  price: number;
  description: string;
  features: string[];
  razorpayPlanId: string;
  isActive: boolean;
  flatLimit?: number;
}




  

  

  
  
  
  