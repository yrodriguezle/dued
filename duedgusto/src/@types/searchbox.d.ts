import { ColDef } from "ag-grid-community";

type ColumnAction = "update" | "remove";

interface DatagridColDef<T> extends ColDef<T> {
  graphField?: string;
  action?: ColumnAction;
  field: keyof T;
}

interface SearchboxOptions<T> {
  query: string;
  id: keyof T;
  tableName: string;
  additionalWhere?: string;
  view?: string;
  items: DatagridColDef<T>[];
  modal: {
    title: string;
    fragment?: string;
    items: DatagridColDef<T>[];
  };
}
