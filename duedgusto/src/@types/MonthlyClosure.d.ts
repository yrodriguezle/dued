export interface MonthlyExpense {
  expenseId: number;
  closureId: number;
  paymentId?: number;
  description: string;
  amount: number;
  category?: string; // FORNITORE, AFFITTO, UTENZE, ALTRO
  createdAt: Date;
  updatedAt: Date;
  // Navigation properties
  closure?: MonthlyClosure;
  payment?: SupplierPayment;
}

export interface MonthlyExpenseInput {
  expenseId?: number;
  closureId: number;
  paymentId?: number;
  description: string;
  amount: number;
  category?: string;
}

export interface MonthlyClosure {
  closureId: number;
  year: number;
  month: number; // 1-12
  lastWorkingDay: Date;
  // Riepilogo incassi (dalla lista cash register)
  totalRevenue?: number;
  totalCash?: number;
  totalElectronic?: number;
  totalInvoices?: number;
  // Spese mensili aggiuntive
  additionalExpenses?: number;
  // Totali finali
  netRevenue?: number;
  status: string; // BOZZA, CHIUSA, RICONCILIATA
  notes?: string;
  closedBy?: number;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Navigation properties
  closedByUser?: User;
  expenses?: MonthlyExpense[];
}

export interface MonthlyClosureInput {
  closureId?: number;
  year: number;
  month: number;
  lastWorkingDay: Date | string;
  notes?: string;
  status?: string;
}
