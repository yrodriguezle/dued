import { DatagridColDef, SearchboxOptions } from "../../../../../@types/searchbox";
import { DatagridStatus } from "../../../../../common/globals/constants";

export type MenuNonNull = Exclude<Menu, null>;

export type MenuWithStatus = MenuNonNull & {
  status: DatagridStatus;
};

const items: DatagridColDef<MenuNonNull>[] = [
  {
    headerName: "ID",
    field: "menuId",
    filter: true,
    sortable: true,
    width: 100,
    hide: true,
  },
  {
    headerName: "Icona",
    field: "icon",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Titolo",
    field: "title",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "View",
    field: "viewName",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Path",
    field: "path",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Menu padre",
    field: "parentMenuId",
    filter: true,
    sortable: true,
    width: 200,
  },
  {
    headerName: "Visibile",
    field: "isVisible",
    filter: true,
    sortable: true,
    width: 200,
  },
];

const roleSearchboxOptions: SearchboxOptions<MenuNonNull> = {
  query: "menus",
  id: "menuId",
  tableName: "menus",
  view: "MenuDetails",
  items,
  modal: {
    title: "Seleziona un menu",
    items,
  },
};

export default roleSearchboxOptions;
