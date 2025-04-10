/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgGridReact } from "ag-grid-react";
import type { RowClickedEvent, ColDef } from "ag-grid-community";

import { ClientSideRowModelModule, ModuleRegistry } from "ag-grid-community";
ModuleRegistry.registerModules([ClientSideRowModelModule]);

import { themeBalham, colorSchemeDark, colorSchemeLight } from "ag-grid-community";

import { DatagridColDef } from "../../../../@types/searchbox";
import useStore from "../../../../store/useStore";

export interface GridResultsProps<T> {
  loading: boolean;
  items: T[];
  columnDefs: DatagridColDef<T>[];
  onRowClicked: (event: RowClickedEvent) => void;
}

const themeLight = themeBalham.withPart(colorSchemeLight);
const themeDark = themeBalham.withPart(colorSchemeDark);

function GridResults<T>({ loading, items, columnDefs, onRowClicked }: GridResultsProps<T>) {
  const { userTheme } = useStore((store) => store);

  if (loading) {
    return <div style={{ padding: 16 }}>Caricamento...</div>;
  }

  // if (!items || items.length === 0) {
  //   return <div style={{ padding: 16 }}>Nessun risultato</div>;
  // }

  return (
    // <div
    //   style={{
    //     backgroundColor: theme.palette.grey[theme.palette.mode === "light" ? 100 : 900],
    //     left: 0,
    //     marginTop: -6,
    //     maxHeight: 300,
    //     overflowY: "auto",
    //     position: "absolute",
    //     right: 0,
    //     top: "100%",
    //     zIndex: 10,
    //   }}
    // >
    <AgGridReact
      theme={userTheme.mode === "light" ? themeLight : themeDark}
      rowData={items}
      columnDefs={columnDefs as unknown as ColDef<T, any>[]}
      onRowClicked={onRowClicked}
      rowSelection="single"
      domLayout="autoHeight"
    />
    // </div>
  );
}

export default GridResults;
