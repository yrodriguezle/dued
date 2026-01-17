export interface SupplierPayment {
  paymentId: number;
  invoiceId?: number;
  ddtId?: number;
  paymentDate: Date;
  amount: number;
  paymentMethod?: string; // CONTANTI, BONIFICO, ASSEGNO, CARTA
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Navigation properties
  invoice?: PurchaseInvoice;
  ddt?: DeliveryNote;
  monthlyExpenses?: MonthlyExpense[];
}

export interface SupplierPaymentInput {
  paymentId?: number;
  invoiceId?: number;
  ddtId?: number;
  paymentDate: Date | string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
}
