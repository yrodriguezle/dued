type DeliveryNote = {
  __typename: "DeliveryNote";
  ddtId: number;
  invoiceId?: number | null;
  supplierId: number;
  supplier?: Supplier;
  invoice?: PurchaseInvoice | null;
  ddtNumber: string;
  ddtDate: string;
  amount?: number | null;
  notes?: string | null;
  payments?: SupplierPayment[];
  createdAt: string;
  updatedAt: string;
};

type DeliveryNoteInput = {
  ddtId?: number;
  invoiceId?: number;
  supplierId: number;
  ddtNumber: string;
  ddtDate: string;
  amount?: number;
  notes?: string;
};
