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

export const cashRegisterFragment = `
  ${userFragment}
  ${cashCountFragment}
  fragment CashRegisterFragment on CashRegister {
    registerId
    date
    userId
    user { ...UserFragment }
    openingCounts { ...CashCountFragment }
    closingCounts { ...CashCountFragment }
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
