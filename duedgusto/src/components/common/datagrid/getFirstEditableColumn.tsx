import { Column } from "ag-grid-community";
import { IRowEvent } from "../../../@types/datagrid";
import isCellEditable from "./isCellEditable";

const getFirstEditableColumn = <T,>(rowEvent: IRowEvent<T>) => {
  const columns: Column[] = rowEvent.api.getAllDisplayedColumns();
  const col = columns
    .find((column) => isCellEditable(column, rowEvent));
  return col;
};

export default getFirstEditableColumn;