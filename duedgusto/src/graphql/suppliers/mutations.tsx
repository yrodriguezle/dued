import { gql, TypedDocumentNode } from "@apollo/client";
import {
  supplierFragment,
  purchaseInvoiceFragment,
  deliveryNoteFragment,
  supplierPaymentFragment,
} from "./fragments";

// ============ SUPPLIER MUTATIONS ============

interface MutateSupplierData {
  suppliers: {
    mutateSupplier: Supplier;
  };
}

interface MutateSupplierVariables {
  supplier: SupplierInput;
}

export const mutationMutateSupplier: TypedDocumentNode<MutateSupplierData, MutateSupplierVariables> = gql`
  ${supplierFragment}
  mutation MutateSupplier($supplier: SupplierInput!) {
    suppliers {
      mutateSupplier(supplier: $supplier) {
        ...SupplierFragment
      }
    }
  }
`;

interface DeleteSupplierData {
  suppliers: {
    deleteSupplier: boolean;
  };
}

interface DeleteSupplierVariables {
  supplierId: number;
}

export const mutationDeleteSupplier: TypedDocumentNode<DeleteSupplierData, DeleteSupplierVariables> = gql`
  mutation DeleteSupplier($supplierId: Int!) {
    suppliers {
      deleteSupplier(supplierId: $supplierId)
    }
  }
`;

// ============ PURCHASE INVOICE MUTATIONS ============

interface MutatePurchaseInvoiceData {
  suppliers: {
    mutatePurchaseInvoice: PurchaseInvoice;
  };
}

interface MutatePurchaseInvoiceVariables {
  invoice: PurchaseInvoiceInput;
}

export const mutationMutatePurchaseInvoice: TypedDocumentNode<MutatePurchaseInvoiceData, MutatePurchaseInvoiceVariables> = gql`
  ${purchaseInvoiceFragment}
  mutation MutatePurchaseInvoice($invoice: PurchaseInvoiceInput!) {
    suppliers {
      mutatePurchaseInvoice(invoice: $invoice) {
        ...PurchaseInvoiceFragment
      }
    }
  }
`;

interface DeletePurchaseInvoiceData {
  suppliers: {
    deletePurchaseInvoice: boolean;
  };
}

interface DeletePurchaseInvoiceVariables {
  invoiceId: number;
}

export const mutationDeletePurchaseInvoice: TypedDocumentNode<DeletePurchaseInvoiceData, DeletePurchaseInvoiceVariables> = gql`
  mutation DeletePurchaseInvoice($invoiceId: Int!) {
    suppliers {
      deletePurchaseInvoice(invoiceId: $invoiceId)
    }
  }
`;

// ============ DELIVERY NOTE MUTATIONS ============

interface MutateDeliveryNoteData {
  suppliers: {
    mutateDeliveryNote: DeliveryNote;
  };
}

interface MutateDeliveryNoteVariables {
  deliveryNote: DeliveryNoteInput;
}

export const mutationMutateDeliveryNote: TypedDocumentNode<MutateDeliveryNoteData, MutateDeliveryNoteVariables> = gql`
  ${deliveryNoteFragment}
  mutation MutateDeliveryNote($deliveryNote: DeliveryNoteInput!) {
    suppliers {
      mutateDeliveryNote(deliveryNote: $deliveryNote) {
        ...DeliveryNoteFragment
      }
    }
  }
`;

interface DeleteDeliveryNoteData {
  suppliers: {
    deleteDeliveryNote: boolean;
  };
}

interface DeleteDeliveryNoteVariables {
  ddtId: number;
}

export const mutationDeleteDeliveryNote: TypedDocumentNode<DeleteDeliveryNoteData, DeleteDeliveryNoteVariables> = gql`
  mutation DeleteDeliveryNote($ddtId: Int!) {
    suppliers {
      deleteDeliveryNote(ddtId: $ddtId)
    }
  }
`;

// ============ SUPPLIER PAYMENT MUTATIONS ============

interface MutateSupplierPaymentData {
  suppliers: {
    mutateSupplierPayment: SupplierPayment;
  };
}

interface MutateSupplierPaymentVariables {
  payment: SupplierPaymentInput;
}

export const mutationMutateSupplierPayment: TypedDocumentNode<MutateSupplierPaymentData, MutateSupplierPaymentVariables> = gql`
  ${supplierPaymentFragment}
  mutation MutateSupplierPayment($payment: SupplierPaymentInput!) {
    suppliers {
      mutateSupplierPayment(payment: $payment) {
        ...SupplierPaymentFragment
      }
    }
  }
`;

interface DeleteSupplierPaymentData {
  suppliers: {
    deleteSupplierPayment: boolean;
  };
}

interface DeleteSupplierPaymentVariables {
  paymentId: number;
}

export const mutationDeleteSupplierPayment: TypedDocumentNode<DeleteSupplierPaymentData, DeleteSupplierPaymentVariables> = gql`
  mutation DeleteSupplierPayment($paymentId: Int!) {
    suppliers {
      deleteSupplierPayment(paymentId: $paymentId)
    }
  }
`;


