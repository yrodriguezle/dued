export interface PurchaseInvoice {
  invoiceId: number;
  supplierId: number;
  invoiceNumber: string;
  invoiceDate: Date;
  taxableAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  status: string; // PAGATA, PARZIALMENTE_PAGATA, DA_PAGARE
  dueDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Navigation properties
  supplier?: Supplier;
  deliveryNotes?: DeliveryNote[];
  payments?: SupplierPayment[];
}

export interface PurchaseInvoiceInput {
  invoiceId?: number;
  supplierId: number;
  invoiceNumber: string;
  invoiceDate: Date | string;
  taxableAmount: number;
  vatRate: number;
  dueDate?: Date | string;
  notes?: string;
  status?: string;
}
