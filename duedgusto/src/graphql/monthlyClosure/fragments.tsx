// src/graphql/monthlyClosure/fragments.tsx
import { gql } from "@apollo/client";

export const MONTHLY_EXPENSE_FRAGMENT = gql`
  fragment MonthlyExpenseFragment on MonthlyExpense {
    id
    closureId
    paymentId
    description
    amount
    category
    createdAt
  }
`;

export const MONTHLY_CLOSURE_FRAGMENT = gql`
  fragment MonthlyClosureFragment on MonthlyClosure {
    id
    year
    month
    lastBusinessDay
    totalRevenue
    totalCash
    totalElectronic
    invoicePayments
    additionalExpenses
    netRevenue
    status
    notes
    closedAt
    createdAt
    closedByUser {
      userId
      username
    }
    expenses {
      ...MonthlyExpenseFragment
    }
  }
  ${MONTHLY_EXPENSE_FRAGMENT}
`;
