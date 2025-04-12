import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";

export type UserSearchbox = Exclude<User, null>;

const items: DatagridColDef<UserSearchbox>[] = [
  {
    headerName: "ID",
    field: "userId",
    hide: true,
    filter: true,
    width: 100,
  },
  {
    headerName: "Nome utente",
    field: "userName",
    filter: true,
    width: 200,
  },
  {
    headerName: "Nome",
    field: "firstName",
    filter: true,
    width: 200,
  },
  {
    headerName: "Cognome",
    field: "lastName",
    filter: true,
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
