export interface DeliveryNote {
  ddtId: number;
  invoiceId?: number;
  supplierId: number;
  ddtNumber: string;
  ddtDate: Date;
  amount?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Navigation properties
  supplier?: Supplier;
  invoice?: PurchaseInvoice;
  payments?: SupplierPayment[];
}

export interface DeliveryNoteInput {
  ddtId?: number;
  invoiceId?: number;
  supplierId: number;
  ddtNumber: string;
  ddtDate: Date | string;
  amount?: number;
  notes?: string;
}
