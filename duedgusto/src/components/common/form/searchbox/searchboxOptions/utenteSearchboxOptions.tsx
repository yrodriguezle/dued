import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";

export type UtenteSearchbox = Exclude<Utente, null>;

const items: DatagridColDef<UtenteSearchbox>[] = [
  {
    headerName: "ID",
    field: "id",
    hide: true,
    filter: true,
    width: 100,
  },
  {
    headerName: "Nome utente",
    field: "nomeUtente",
    filter: true,
    width: 200,
  },
  {
    headerName: "Nome",
    field: "nome",
    filter: true,
    width: 200,
  },
  {
    headerName: "Cognome",
    field: "cognome",
    filter: true,
    width: 200,
  },
];

const utenteSearchboxOption: SearchboxOptions<UtenteSearchbox> = {
  query: "utenti",
  id: "id",
  tableName: "utenti",
  view: "UserDetails",
  items,
  modal: {
    title: "Seleziona un utente",
    items,
  },
};

export default utenteSearchboxOption;
