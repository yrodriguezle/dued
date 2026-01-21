import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";
import { DatagridStatus } from "../../../../../common/globals/constants";

export type MenuNonNull = Exclude<Menu, null>;

export type MenuWithStatus = MenuNonNull & {
  status: DatagridStatus;
};

const items: DatagridColDef<MenuNonNull>[] = [
  {
    headerName: "ID",
    field: "id",
    filter: true,
    sortable: true,
    width: 100,
    hide: true,
  },
  {
    headerName: "Icona",
    field: "icona",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Titolo",
    field: "titolo",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "View",
    field: "nomeVista",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Percorso",
    field: "percorso",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Menu padre",
    field: "menuPadreId",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Visibile",
    field: "visibile",
    filter: true,
    sortable: true,
    width: 200,
  },
];

const menuSearchboxOptions: SearchboxOptions<MenuNonNull> = {
  query: "menus",
  id: "id",
  tableName: "menus",
  view: "MenuDetails",
  items,
  modal: {
    title: "Seleziona un menu",
    items,
  },
};

export default menuSearchboxOptions;
