// src/app/models/admin-user.model.ts
export interface AdminUser {
    id?: string;            // Firestore document ID (optional for new entries)
    name: string;           // Admin's name
    phone: string;          // Admin's phone number
    apartmentId: string;    // The apartment name or ID they manage
    isActive: boolean;      // Whether the admin is currently active
  }
  