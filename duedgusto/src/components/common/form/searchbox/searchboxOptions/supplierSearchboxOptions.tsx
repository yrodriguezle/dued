import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";

export type SupplierSearchbox = Exclude<Supplier, null>;

const items: DatagridColDef<SupplierSearchbox>[] = [
  {
    headerName: "ID",
    field: "supplierId",
    hide: true,
    filter: true,
    width: 100,
  },
  {
    headerName: "Ragione Sociale",
    field: "businessName",
    filter: true,
    width: 300,
  },
  {
    headerName: "P.IVA",
    field: "vatNumber",
    filter: true,
    width: 150,
  },
  {
    headerName: "Città",
    field: "city",
    filter: true,
    width: 150,
  },
];

const supplierSearchboxOption: SearchboxOptions<SupplierSearchbox> = {
  query: "fornitori",
  id: "supplierId",
  tableName: "fornitori",
  view: "SupplierDetails",
  items,
  modal: {
    title: "Seleziona un fornitore",
    items,
  },
};

export default supplierSearchboxOption;
