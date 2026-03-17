export type UserRole = 'admin' | 'vendor';

export type OpportunityStatus = 'Open' | 'Quoted' | 'Closed/Won' | 'Closed/Lost';

export type FulfillmentType = 'Parcel' | 'Freight' | 'Both';

export type Carrier = 'UPS' | 'FedEx' | 'USPS' | 'DHL' | 'Amazon Shipping' | 'Other';

export const CARRIERS: Carrier[] = ['UPS', 'FedEx', 'USPS', 'DHL', 'Amazon Shipping', 'Other'];

export const STATUSES: OpportunityStatus[] = ['Open', 'Quoted', 'Closed/Won', 'Closed/Lost'];

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company: string;
  phone: string;
  role: UserRole;
  requires_password_change?: boolean;
  receive_submission_notifications?: boolean;
  created_at: string;
}

export type ShippingScope = 'Domestic' | 'International' | 'Both';

export interface Opportunity {
  id: string;
  name: string;
  description: string;
  carriers: string[];
  annual_volume: string;
  fulfillment_type: FulfillmentType;
  shipping_scope: ShippingScope;
  status: OpportunityStatus;
  deadline: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityFile {
  id: string;
  opportunity_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_at: string;
}

export interface VendorInterest {
  id: string;
  opportunity_id: string;
  vendor_id: string;
  admin_notes: string;
  created_at: string;
  // Joined fields
  profiles?: Profile;
}

export interface VendorView {
  id: string;
  opportunity_id: string;
  vendor_id: string;
  viewed_at: string;
  // Joined fields
  profiles?: Profile;
}

export interface VendorSubmission {
  id: string;
  opportunity_id: string;
  vendor_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
  // Joined fields
  profiles?: Profile;
}
