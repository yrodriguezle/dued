import { DatagridColDef } from "../@types/Datagrid";
import RowNumberCellRenderer from "./RowNumberColumn";

function createRowNumberColumn<T extends object>(): DatagridColDef<T> {
  return {
    headerName: "#",
    colId: "__rowNumber",
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
