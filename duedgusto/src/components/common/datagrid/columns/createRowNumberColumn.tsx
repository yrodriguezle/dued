import { DatagridColDef, DatagridData } from "../@types/Datagrid";
import RowNumberCellRenderer from "./RowNumberColumn";
import { ColDefField } from "ag-grid-community";

function createRowNumberColumn<T extends Record<string, unknown>>(): DatagridColDef<T> {
  return {
    headerName: "#",
    field: "__rowNumber" as ColDefField<DatagridData<T>>,
    width: 50,
    minWidth: 50,
    maxWidth: 50,
    pinned: "left",
    lockPosition: true,
    editable: false,
    suppressMovable: true,
    suppressColumnsToolPanel: true,
    cellRenderer: RowNumberCellRenderer,
    cellStyle: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
    },
  };
}

export default createRowNumberColumn;
