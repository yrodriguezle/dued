import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";
import { hiddenColumnProperties } from "../../../datagrid/datagridUtils";

export type RoleNonNull = Exclude<Role, null>;

const items: DatagridColDef<RoleNonNull>[] = [
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
  {
    headerName: "Descrizione",
    field: "roleDescription",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    field: "menuIds",
    filter: true,
    sortable: true,
    ...hiddenColumnProperties,
    valueFormatter: ({ value }: { value?: string[] }) => value?.join(",") || "",
  },
];

const roleSearchboxOptions: SearchboxOptions<RoleNonNull> = {
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
