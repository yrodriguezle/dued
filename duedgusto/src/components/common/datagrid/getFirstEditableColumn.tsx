import { Column } from "ag-grid-community";
import isCellEditable from "./isCellEditable";
import { IRowEvent } from "./@types/Datagrid";

const getFirstEditableColumn = <T extends Record<string, unknown>>(rowEvent: IRowEvent<T>) => {
  const columns: Column[] = rowEvent.api.getAllDisplayedColumns();
  const col = columns.find((column) => isCellEditable(column, rowEvent));
  return col;
};

export default getFirstEditableColumn;
