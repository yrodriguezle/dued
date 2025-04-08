import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";

export type RoleSearchbox = Exclude<Role, null>;

const items: DatagridColDef<RoleSearchbox>[] = [
  {
    headerName: "ID",
    field: "roleId",
    filter: true,
    sortable: true,
    width: 100,
  },
  {
    headerName: "Role",
    field: "roleName",
    filter: true,
    sortable: true,
    width: 200,
  },
];

const roleSearchboxOptions: SearchboxOptions<RoleSearchbox> = {
  query: "roles",
  id: "roleId",
  tableName: "roles",
  view: "RoleDetails",
  items,
  modal: {
    title: "Seleziona un ruolo",
    items,
  },
};

export default roleSearchboxOptions;
