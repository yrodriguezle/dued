export interface Supplier {
  supplierId: number;
  businessName: string;
  vatNumber?: string;
  fiscalCode?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  notes?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Navigation properties
  purchaseInvoices?: PurchaseInvoice[];
  deliveryNotes?: DeliveryNote[];
}

export interface SupplierInput {
  supplierId?: number;
  businessName: string;
  vatNumber?: string;
  fiscalCode?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  notes?: string;
  active?: boolean;
}
