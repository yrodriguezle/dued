import { utenteFragment } from "../utente/fragment";

export const cashRegisterFragment = `
  ${utenteFragment}
  fragment CashRegisterFragment on CashRegister {
    registerId
    date
    utenteId
    utente { ...UtenteFragment }
    openingTotal
    closingTotal
    cashSales
    cashInWhite
    electronicPayments
    invoicePayments
    totalSales
    supplierExpenses
    dailyExpenses
    expectedCash
    difference
    netCash
    vatAmount
    notes
    status
    createdAt
    updatedAt
  }
`;

export const cashCountFragment = `
  fragment CashCountFragment on CashCount {
    countId
    registerId
    denominationId
    quantity
    total
    isOpening
  }
`;

export const cashIncomeFragment = `
  fragment CashIncomeFragment on CashIncome {
    incomeId
    registerId
    type
    amount
  }
`;

export const cashExpenseFragment = `
  fragment CashExpenseFragment on CashExpense {
    expenseId
    registerId
    description
    amount
  }
`;
