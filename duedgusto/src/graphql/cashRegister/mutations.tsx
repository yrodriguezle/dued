import { gql, TypedDocumentNode } from "@apollo/client";
import { cashRegisterFragment } from "./fragments";

// Submit (create or update) cash register
interface SubmitCashRegisterData {
  cashManagement: {
    mutateCashRegister: CashRegister;
  };
}

export interface CashCountInput {
  denominationId: number;
  quantity: number;
}

export interface CashIncomeInput {
  type: string;
  amount: number;
}

export interface CashExpenseInput {
  description: string;
  amount: number;
}

export interface CashRegisterInput {
  registerId?: number;
  date: string;
  userId: number;
  openingCounts: CashCountInput[];
  closingCounts: CashCountInput[];
  incomes: CashIncomeInput[];
  expenses: CashExpenseInput[];
  cashInWhite: number;
  electronicPayments: number;
  invoicePayments: number;
  supplierExpenses: number;
  dailyExpenses: number;
  notes?: string;
  status: CashRegisterStatus;
}

export interface SubmitCashRegisterValues {
  cashRegister: CashRegisterInput;
}

export const mutationSubmitCashRegister: TypedDocumentNode<SubmitCashRegisterData, SubmitCashRegisterValues> = gql`
  ${cashRegisterFragment}
  mutation SubmitCashRegister($cashRegister: CashRegisterInput!) {
    cashManagement {
      mutateCashRegister(cashRegister: $cashRegister) {
        ...CashRegisterFragment
      }
    }
  }
`;

// Close cash register (change status to CLOSED)
interface CloseCashRegisterData {
  cashManagement: {
    closeCashRegister: CashRegister;
  };
}

interface CloseCashRegisterValues {
  registerId: number;
}

export const mutationCloseCashRegister: TypedDocumentNode<CloseCashRegisterData, CloseCashRegisterValues> = gql`
  ${cashRegisterFragment}
  mutation CloseCashRegister($registerId: Int!) {
    cashManagement {
      closeCashRegister(registerId: $registerId) {
        ...CashRegisterFragment
      }
    }
  }
`;

// Delete cash register
interface DeleteCashRegisterData {
  cashManagement: {
    deleteCashRegister: boolean;
  };
}

interface DeleteCashRegisterValues {
  registerId: number;
}

export const mutationDeleteCashRegister: TypedDocumentNode<DeleteCashRegisterData, DeleteCashRegisterValues> = gql`
  mutation DeleteCashRegister($registerId: Int!) {
    cashManagement {
      deleteCashRegister(registerId: $registerId)
    }
  }
`;
