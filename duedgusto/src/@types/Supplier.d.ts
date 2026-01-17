type Supplier = {
  __typename: "Supplier";
  supplierId: number;
  businessName: string;
  vatNumber?: string | null;
  fiscalCode?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  province?: string | null;
  country: string;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  purchaseInvoices?: PurchaseInvoice[];
  deliveryNotes?: DeliveryNote[];
};

type SupplierInput = {
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
};
