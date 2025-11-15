// Cash Register Type Definitions

type CashDenominationType = "COIN" | "BANKNOTE";
type CashRegisterStatus = "DRAFT" | "CLOSED" | "RECONCILED";

type CashDenomination = {
  __typename: "CashDenomination";
  denominationId: number;
  value: number;
  type: CashDenominationType;
  displayOrder: number;
};

type CashCount = {
  __typename: "CashCount";
  countId: number;
  registerId: number;
  denominationId: number;
  denomination: CashDenomination;
  quantity: number;
  total: number;
  isOpening: boolean;
};

type CashRegister = {
  __typename: "CashRegister";
  registerId: number;
  date: string;
  userId: number;
  user: User;
  openingCounts: CashCount[];
  closingCounts: CashCount[];
  openingTotal: number;
  closingTotal: number;
  cashSales: number;
  electronicPayments: number;
  totalSales: number;
  supplierExpenses: number;
  dailyExpenses: number;
  expectedCash: number;
  difference: number;
  netCash: number;
  vatAmount: number;
  notes: string | null;
  status: CashRegisterStatus;
  createdAt: string;
  updatedAt: string;
};

// Form values for Formik
type FormikCashCountValues = {
  denominationId: number;
  quantity: number;
};

type FormikCashRegisterValues = {
  registerId?: number;
  date: string;
  userId: number;
  openingCounts: FormikCashCountValues[];
  closingCounts: FormikCashCountValues[];
  supplierExpenses: number;
  dailyExpenses: number;
  notes: string;
  status: CashRegisterStatus;
};

// Dashboard KPIs
type CashRegisterKPI = {
  todaySales: number;
  todayDifference: number;
  monthSales: number;
  monthAverage: number;
  weekTrend: number;
};

// Monthly summary
type MonthlyCashSummary = {
  month: string;
  year: number;
  totalSales: number;
  totalCash: number;
  totalElectronic: number;
  averageDaily: number;
  daysWithDifferences: number;
  totalVat: number;
  registers: CashRegister[];
};
