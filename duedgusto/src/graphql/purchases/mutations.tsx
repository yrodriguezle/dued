import { gql } from "@apollo/client";
import { purchaseInvoiceFragment } from "../suppliers/fragments";

export const mutationMutatePurchaseInvoice = gql`
  ${purchaseInvoiceFragment}
  mutation MutatePurchaseInvoice($invoice: PurchaseInvoiceInput!) {
    suppliers {
      mutatePurchaseInvoice(invoice: $invoice) {
        ...PurchaseInvoiceFragment
      }
    }
  }
`;

export const mutationDeletePurchaseInvoice = gql`
  mutation DeletePurchaseInvoice($invoiceId: Int!) {
    suppliers {
      deletePurchaseInvoice(invoiceId: $invoiceId)
    }
  }
`;
