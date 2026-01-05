import { gql, TypedDocumentNode } from "@apollo/client";
import { cashDenominationFragment, cashRegisterFragment } from "./fragments";

// Get all denominations
interface GetDenominationsData {
  cashManagement: {
    denominations: CashDenomination[];
  };
}

export const getDenominations: TypedDocumentNode<GetDenominationsData> = gql(`
  ${cashDenominationFragment}
  query GetDenominations {
    cashManagement {
      denominations {
        ...CashDenominationFragment
      }
    }
  }`);

// Get single cash register by ID
interface GetCashRegisterData {
  cashManagement: {
    cashRegister: CashRegister;
  };
}

interface GetCashRegisterVariables {
  registerId?: number;
  date?: string;
}

export const getCashRegister: TypedDocumentNode<GetCashRegisterData, GetCashRegisterVariables> = gql(`
  ${cashRegisterFragment}
  query GetCashRegister($registerId: Int, $date: DateTime) {
    cashManagement {
      cashRegister(registerId: $registerId, date: $date) {
        ...CashRegisterFragment
      }
    }
  }`);

// Get cash registers with relay pagination
export const getCashRegisters = gql(`
  ${cashRegisterFragment}
  query GetCashRegisters($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    cashManagement {
      cashRegistersConnection(first: $pageSize, where: $where, order: $orderBy, after: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        items {
          ...CashRegisterFragment
        }
      }
    }
  }`);

// Get monthly summary
interface GetMonthlySummaryData {
  cashManagement: {
    monthlySummary: MonthlyCashSummary;
  };
}

interface GetMonthlySummaryVariables {
  year: number;
  month: number;
}

export const getMonthlySummary: TypedDocumentNode<GetMonthlySummaryData, GetMonthlySummaryVariables> = gql(`
  query GetMonthlySummary($year: Int!, $month: Int!) {
    cashManagement {
      monthlySummary(year: $year, month: $month) {
        month
        year
        totalSales
        totalCash
        totalElectronic
        averageDaily
        daysWithDifferences
        totalVat
      }
    }
  }`);

// Get dashboard KPIs
interface GetDashboardKPIsData {
  cashManagement: {
    dashboardKPIs: CashRegisterKPI;
  };
}

export const getDashboardKPIs: TypedDocumentNode<GetDashboardKPIsData> = gql(`
  query GetDashboardKPIs {
    cashManagement {
      dashboardKPIs {
        todaySales
        todayDifference
        monthSales
        monthAverage
        weekTrend
      }
    }
  }`);
