import { userFragment } from "../user/fragment";

export const cashDenominationFragment = `fragment CashDenominationFragment on CashDenomination {
  denominationId
  value
  type
  displayOrder
}`;

export const cashCountFragment = `
  ${cashDenominationFragment}
  fragment CashCountFragment on CashCount {
    countId
    registerId
    denominationId
    denomination { ...CashDenominationFragment }
    quantity
    total
    isOpening
  }`;

export const cashIncomeFragment = `fragment CashIncomeFragment on CashIncome {
  incomeId
  registerId
  type
  amount
}`;

export const cashExpenseFragment = `fragment CashExpenseFragment on CashExpense {
  expenseId
  registerId
  description
  amount
}`;

export const cashRegisterFragment = `
  ${userFragment}
  ${cashCountFragment}
  ${cashIncomeFragment}
  ${cashExpenseFragment}
  fragment CashRegisterFragment on CashRegister {
    registerId
    date
    userId
    user { ...UserFragment }
    openingCounts { ...CashCountFragment }
    closingCounts { ...CashCountFragment }
    incomes { ...CashIncomeFragment }
    expenses { ...CashExpenseFragment }
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
  }`;
