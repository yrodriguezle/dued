import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";
import { hiddenColumnProperties } from "../../../datagrid/datagridUtils";

export type RuoloNonNull = Exclude<Ruolo, null>;

const items: DatagridColDef<RuoloNonNull>[] = [
  {
    headerName: "ID",
    field: "id",
    filter: true,
    sortable: true,
    width: 100,
  },
  {
    headerName: "Ruolo",
    field: "nome",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Descrizione",
    field: "descrizione",
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

const ruoloSearchboxOptions: SearchboxOptions<RuoloNonNull> = {
  query: "ruoli",
  id: "id",
  tableName: "ruoli",
  view: "RoleDetails",
  items,
  modal: {
    title: "Seleziona un ruolo",
    items,
  },
};

export default ruoloSearchboxOptions;
