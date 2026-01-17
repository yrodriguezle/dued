type PurchaseInvoice = {
  __typename: "PurchaseInvoice";
  invoiceId: number;
  supplierId: number;
  supplier?: Supplier;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  taxableAmount: number;
  vatAmount?: number | null;
  totalAmount?: number | null;
  invoiceStatus: "DA_PAGARE" | "PARZIALMENTE_PAGATA" | "PAGATA";
  notes?: string | null;
  deliveryNotes?: DeliveryNote[];
  payments?: SupplierPayment[];
  createdAt: string;
  updatedAt: string;
};

type PurchaseInvoiceInput = {
  invoiceId?: number;
  supplierId: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  taxableAmount: number;
  vatRate: number;
  invoiceStatus?: string;
  notes?: string;
};
