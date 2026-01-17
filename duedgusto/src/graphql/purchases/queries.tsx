import { gql } from "@apollo/client";
import { purchaseInvoiceFragment } from "../suppliers/fragments";

export const getPurchaseInvoices = gql`
  ${purchaseInvoiceFragment}
  query GetPurchaseInvoices {
    suppliers {
      purchaseInvoices {
        ...PurchaseInvoiceFragment
      }
    }
  }
`;

export const getPurchaseInvoice = gql`
  ${purchaseInvoiceFragment}
  query GetPurchaseInvoice($invoiceId: Int!) {
    suppliers {
      purchaseInvoice(invoiceId: $invoiceId) {
        ...PurchaseInvoiceFragment
        deliveryNotes {
          ddtId
          ddtNumber
          ddtDate
          amount
        }
        payments {
          paymentId
          paymentDate
          amount
          paymentMethod
        }
      }
    }
  }
`;
