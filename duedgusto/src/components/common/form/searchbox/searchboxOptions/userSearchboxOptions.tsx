import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";

export type UserSearchbox = Exclude<User, null>;

const items: DatagridColDef<UserSearchbox>[] = [
  {
    headerName: "ID",
    field: "userId",
    filter: true,
    sortable: true,
    width: 100,
  },
  {
    headerName: "Nome utente",
    field: "userName",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Nome",
    field: "firstName",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Cognome",
    field: "lastName",
    filter: true,
    sortable: true,
    width: 200,
  },
];

const userSearchboxOption: SearchboxOptions<UserSearchbox> = {
  query: "users",
  id: "userId",
  tableName: "users",
  view: "UserDetails",
  items,
  modal: {
    title: "Seleziona un utente",
    items,
  },
};

export default userSearchboxOption;
