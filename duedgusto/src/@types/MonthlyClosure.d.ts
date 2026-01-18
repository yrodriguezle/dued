// src/@types/MonthlyClosure.d.ts

type MonthlyExpense = {
    __typename: "MonthlyExpense";
    id: number;
    closureId: number;
    paymentId: number | null;
    payment: SupplierPayment | null;
    description: string;
    amount: number;
    category: string | null;
    createdAt: string;
    updatedAt: string;
};
  
type MonthlyClosure = {
    __typename: "MonthlyClosure";
    id: number;
    year: number;
    month: number;
    lastBusinessDay: string;

    // Riepilogo incassi
    totalRevenue: number | null;
    totalCash: number | null;
    totalElectronic: number | null;
    invoicePayments: number | null;

    // Spese mensili
    additionalExpenses: number | null;
    expenses: MonthlyExpense[];

    // Totali finali
    netRevenue: number | null;

    status: "BOZZA" | "CHIUSA" | "RICONCILIATA";
    notes: string | null;
    closedBy: number | null;
    closedByUser: User | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
};
  
type MonthlyClosureInput = {
    id?: number;
    year: number;
    month: number;
    lastBusinessDay: string;
    totalRevenue?: number;
    totalCash?: number;
    totalElectronic?: number;
    invoicePayments?: number;
    additionalExpenses?: number;
    netRevenue?: number;
    status?: string;
    notes?: string;
    expenses?: MonthlyExpenseInput[];
};
  
type MonthlyExpenseInput = {
    id?: number;
    paymentId?: number;
    description: string;
    amount: number;
    category?: string;
};