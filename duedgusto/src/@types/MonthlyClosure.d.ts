type MonthlyExpense = {
  __typename: "MonthlyExpense";
  expenseId: number;
  closureId: number;
  paymentId?: number | null;
  closure?: MonthlyClosure;
  payment?: SupplierPayment | null;
  description: string;
  amount: number;
  category?: string | null;
  createdAt: string;
  updatedAt: string;
};

type MonthlyExpenseInput = {
  expenseId?: number;
  closureId: number;
  paymentId?: number;
  description: string;
  amount: number;
  category?: string;
};

type MonthlyClosure = {
  __typename: "MonthlyClosure";
  closureId: number;
  year: number;
  month: number;
  lastWorkingDay: string;
  totalRevenue?: number | null;
  totalCash?: number | null;
  totalElectronic?: number | null;
  totalInvoices?: number | null;
  additionalExpenses?: number | null;
  netRevenue?: number | null;
  closureStatus: string;
  notes?: string | null;
  closedBy?: number | null;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  closedByUser?: User;
  expenses?: MonthlyExpense[];
};

type MonthlyClosureInput = {
  closureId?: number;
  year: number;
  month: number;
  lastWorkingDay: string;
  notes?: string;
  closureStatus?: string;
};
