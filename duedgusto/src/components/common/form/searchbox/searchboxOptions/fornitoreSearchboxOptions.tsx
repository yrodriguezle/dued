import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";

export type FornitoreSearchbox = Exclude<Fornitore, null>;

const items: DatagridColDef<FornitoreSearchbox>[] = [
  {
    headerName: "ID",
    field: "fornitoreId",
    hide: true,
    filter: true,
    width: 100,
  },
  {
    headerName: "Ragione Sociale",
    field: "ragioneSociale",
    filter: true,
    width: 300,
  },
  {
    headerName: "P.IVA",
    field: "partitaIva",
    filter: true,
    width: 150,
  },
  {
    headerName: "Citta",
    field: "citta",
    filter: true,
    width: 150,
  },
];

const fornitoreSearchboxOption: SearchboxOptions<FornitoreSearchbox> = {
  query: "fornitori",
  id: "fornitoreId",
  tableName: "fornitori",
  view: "FornitoreDetails",
  items,
  modal: {
    title: "Seleziona un fornitore",
    items,
  },
};

export default fornitoreSearchboxOption;
