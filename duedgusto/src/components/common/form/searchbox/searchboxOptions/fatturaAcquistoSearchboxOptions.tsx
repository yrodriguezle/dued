import { SearchboxColDef, SearchboxOptions } from "../../../../../@types/searchbox";

export type FatturaAcquistoSearchbox = {
  fatturaId: number;
  numeroFattura: string;
  dataFattura: string;
  imponibile: number;
};

const items: SearchboxColDef<FatturaAcquistoSearchbox>[] = [
  {
    headerName: "ID",
    field: "fatturaId",
    hide: true,
    filter: true,
    width: 100,
  },
  {
    headerName: "Numero Fattura",
    field: "numeroFattura",
    filter: true,
    width: 200,
  },
  {
    headerName: "Data Fattura",
    field: "dataFattura",
    filter: true,
    width: 150,
  },
  {
    headerName: "Imponibile",
    field: "imponibile",
    filter: true,
    width: 130,
    valueFormatter: (params) => (params.value != null ? Number(params.value).toFixed(2) : ""),
  },
];

const fatturaAcquistoSearchboxOption: SearchboxOptions<FatturaAcquistoSearchbox> = {
  query: "fattureAcquisto",
  id: "fatturaId",
  tableName: "fattureAcquisto",
  items,
  modal: {
    title: "Seleziona una fattura",
    items,
  },
};

export default fatturaAcquistoSearchboxOption;
