type SupplierPayment = {
  __typename: "SupplierPayment";
  paymentId: number;
  invoiceId?: number | null;
  ddtId?: number | null;
  invoice?: PurchaseInvoice | null;
  ddt?: DeliveryNote | null;
  paymentDate: string;
  amount: number;
  paymentMethod?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

type SupplierPaymentInput = {
  paymentId?: number;
  invoiceId?: number;
  ddtId?: number;
  paymentDate: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
};
