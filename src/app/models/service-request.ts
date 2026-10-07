// src/app/models/service-request.model.ts
export interface ServiceRequest {
    id?: string;           // Firestore document ID (optional for new requests)
    apartment: string;     // Name or ID of the apartment sending the request
    type: string;          // Type of request (e.g., "Issue", "Access", etc.)
    message: string;       // Details about the request
    timestamp?: any;       // Optional: Firebase timestamp (for sorting)
  }
  