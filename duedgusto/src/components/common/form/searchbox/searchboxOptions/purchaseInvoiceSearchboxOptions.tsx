import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";

export type PurchaseInvoiceSearchbox = {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  taxableAmount: number;
};

const items: DatagridColDef<PurchaseInvoiceSearchbox>[] = [
  {
    headerName: "ID",
    field: "invoiceId",
    hide: true,
    filter: true,
    width: 100,
  },
  {
    headerName: "Numero Fattura",
    field: "invoiceNumber",
    filter: true,
    width: 200,
  },
  {
    headerName: "Data Fattura",
    field: "invoiceDate",
    filter: true,
    width: 150,
  },
  {
    headerName: "Imponibile",
    field: "taxableAmount",
    filter: true,
    width: 130,
    valueFormatter: (params) => (params.value != null ? Number(params.value).toFixed(2) : ""),
  },
];

const purchaseInvoiceSearchboxOption: SearchboxOptions<PurchaseInvoiceSearchbox> = {
  query: "purchaseInvoices",
  id: "invoiceId",
  tableName: "purchaseInvoices",
  items,
  modal: {
    title: "Seleziona una fattura",
    items,
  },
};

export default purchaseInvoiceSearchboxOption;
