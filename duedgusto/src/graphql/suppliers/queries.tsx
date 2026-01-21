import { gql, TypedDocumentNode } from "@apollo/client";
import {
  supplierFragment,
  purchaseInvoiceFragment,
  deliveryNoteFragment,
  supplierPaymentFragment,
  monthlyClosureFragment,
  monthlyExpenseFragment,
} from "./fragments";

// Get all suppliers
interface GetSuppliersData {
  suppliers: {
    suppliers: Supplier[];
  };
}

export const getSuppliers: TypedDocumentNode<GetSuppliersData> = gql(`
  ${supplierFragment}
  query GetSuppliers {
    suppliers {
      suppliers {
        ...SupplierFragment
      }
    }
  }`);

// Get suppliers with pagination
export const getSuppliersConnection = gql(`
  ${supplierFragment}
  query GetSuppliersConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      suppliers(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...SupplierFragment
          }
          cursor
        }
      }
    }
  }`);

// Get single supplier by ID
interface GetSupplierData {
  suppliers: {
    supplier: Supplier;
  };
}

interface GetSupplierVariables {
  supplierId: number;
}

export const getSupplier: TypedDocumentNode<GetSupplierData, GetSupplierVariables> = gql(`
  ${supplierFragment}
  query GetSupplier($supplierId: Int!) {
    suppliers {
      supplier(supplierId: $supplierId) {
        ...SupplierFragment
      }
    }
  }`);

// Get purchase invoices with pagination
export const getPurchaseInvoicesConnection = gql(`
  ${purchaseInvoiceFragment}
  query GetPurchaseInvoicesConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      purchaseInvoices(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...PurchaseInvoiceFragment
          }
          cursor
        }
      }
    }
  }`);

// Get single purchase invoice by ID
interface GetPurchaseInvoiceData {
  suppliers: {
    purchaseInvoice: PurchaseInvoice;
  };
}

interface GetPurchaseInvoiceVariables {
  invoiceId: number;
}

export const getPurchaseInvoice: TypedDocumentNode<GetPurchaseInvoiceData, GetPurchaseInvoiceVariables> = gql(`
  ${purchaseInvoiceFragment}
  ${deliveryNoteFragment}
  ${supplierPaymentFragment}
  query GetPurchaseInvoice($invoiceId: Int!) {
    suppliers {
      purchaseInvoice(invoiceId: $invoiceId) {
        ...PurchaseInvoiceFragment
        deliveryNotes { ...DeliveryNoteFragment }
        payments { ...SupplierPaymentFragment }
      }
    }
  }`);

// Get delivery notes with pagination
export const getDeliveryNotesConnection = gql(`
  ${deliveryNoteFragment}
  query GetDeliveryNotesConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      deliveryNotes(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...DeliveryNoteFragment
          }
          cursor
        }
      }
    }
  }`);

// Get single delivery note by ID
interface GetDeliveryNoteData {
  suppliers: {
    deliveryNote: DeliveryNote;
  };
}

interface GetDeliveryNoteVariables {
  ddtId: number;
}

export const getDeliveryNote: TypedDocumentNode<GetDeliveryNoteData, GetDeliveryNoteVariables> = gql(`
  ${deliveryNoteFragment}
  ${supplierPaymentFragment}
  query GetDeliveryNote($ddtId: Int!) {
    suppliers {
      deliveryNote(ddtId: $ddtId) {
        ...DeliveryNoteFragment
        payments { ...SupplierPaymentFragment }
      }
    }
  }`);

// Get supplier payments with pagination
export const getSupplierPaymentsConnection = gql(`
  ${supplierPaymentFragment}
  query GetSupplierPaymentsConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      supplierPayments(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...SupplierPaymentFragment
          }
          cursor
        }
      }
    }
  }`);

// Get monthly closures with pagination
export const getChiusuraMensilesConnection = gql(`
  ${monthlyClosureFragment}
  query GetChiusuraMensilesConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      monthlyClosures(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...ChiusuraMensileFragment
          }
          cursor
        }
      }
    }
  }`);

// Get single monthly closure
interface GetChiusuraMensileData {
  monthlyClosures: {
    monthlyClosure: ChiusuraMensile;
  };
}

interface GetChiusuraMensileVariables {
  year: number;
  month: number;
}

export const getChiusuraMensile: TypedDocumentNode<GetChiusuraMensileData, GetChiusuraMensileVariables> = gql(`
  ${monthlyClosureFragment}
  query GetChiusuraMensile($year: Int!, $month: Int!) {
    monthlyClosures {
      monthlyClosure(year: $year, month: $month) {
        ...ChiusuraMensileFragment
      }
    }
  }`);

// Get monthly closure by ID
interface GetChiusuraMensileByIdData {
  monthlyClosures: {
    monthlyClosureById: ChiusuraMensile;
  };
}

interface GetChiusuraMensileByIdVariables {
  closureId: number;
}

export const getChiusuraMensileById: TypedDocumentNode<GetChiusuraMensileByIdData, GetChiusuraMensileByIdVariables> = gql(`
  ${monthlyClosureFragment}
  query GetChiusuraMensileById($closureId: Int!) {
    monthlyClosures {
      monthlyClosureById(closureId: $closureId) {
        ...ChiusuraMensileFragment
      }
    }
  }`);

// Get monthly expenses with pagination
export const getMonthlyExpensesConnection = gql(`
  ${monthlyExpenseFragment}
  query GetMonthlyExpensesConnection($pageSize: Int!, $where: String, $orderBy: String, $cursor: Int) {
    connection {
      monthlyExpenses(first: $pageSize, where: $where, orderBy: $orderBy, cursor: $cursor) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        edges {
          node {
            ...MonthlyExpenseFragment
          }
          cursor
        }
      }
    }
  }`);
