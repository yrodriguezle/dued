export const supplierFragment = `fragment SupplierFragment on Supplier {
  supplierId
  businessName
  vatNumber
  fiscalCode
  email
  phone
  address
  city
  postalCode
  province
  country
  notes
  active
  createdAt
  updatedAt
}`;

export const purchaseInvoiceFragment = `
  ${supplierFragment}
  fragment PurchaseInvoiceFragment on PurchaseInvoice {
    invoiceId
    supplierId
    supplier { ...SupplierFragment }
    invoiceNumber
    invoiceDate
    taxableAmount
    vatAmount
    totalAmount
    invoiceStatus: status
    dueDate
    notes
    createdAt
    updatedAt
  }`;

export const deliveryNoteFragment = `
  ${supplierFragment}
  fragment DeliveryNoteFragment on DeliveryNote {
    ddtId
    invoiceId
    supplierId
    supplier { ...SupplierFragment }
    ddtNumber
    ddtDate
    amount
    notes
    createdAt
    updatedAt
  }`;

export const supplierPaymentFragment = `
  ${purchaseInvoiceFragment}
  ${deliveryNoteFragment}
  fragment SupplierPaymentFragment on SupplierPayment {
    paymentId
    invoiceId
    invoice { ...PurchaseInvoiceFragment }
    ddtId
    ddt { ...DeliveryNoteFragment }
    paymentDate
    amount
    paymentMethod
    notes
    createdAt
    updatedAt
  }`;

export const monthlyExpenseFragment = `
  ${supplierPaymentFragment}
  fragment MonthlyExpenseFragment on MonthlyExpense {
    expenseId
    closureId
    paymentId
    payment { ...SupplierPaymentFragment }
    description
    amount
    category
    createdAt
    updatedAt
  }`;

export const monthlyClosureFragment = `
  ${monthlyExpenseFragment}
  fragment MonthlyClosureFragment on MonthlyClosure {
    closureId
    year
    month
    lastWorkingDay
    totalRevenue
    totalCash
    totalElectronic
    totalInvoices
    additionalExpenses
    netRevenue
    closureStatus: status
    notes
    closedBy
    closedAt
    createdAt
    updatedAt
    expenses { ...MonthlyExpenseFragment }
  }`;
