export interface AdminQuery {
    id?: string;
  apartment: string;
  adminPhone: string;
  message: string;
  status: 'Pending' | 'Resolved';
  timestamp: number;
  }
  