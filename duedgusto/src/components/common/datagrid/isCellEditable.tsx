import { Column } from "ag-grid-community";
import { datagridAuxiliaryColumns } from "../../../common/globals/constants";
import { IRowEvent } from "./@types/Datagrid";

function isCellEditable<T>(column: Column, rowEvent: IRowEvent<T>) {
  if (!column || datagridAuxiliaryColumns.includes(column?.getColId() || "") || !rowEvent.node) {
    return false;
  }
  return column.isCellEditable(rowEvent.node);
}

export default isCellEditable;
