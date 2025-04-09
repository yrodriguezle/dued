/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgGridReact } from "ag-grid-react";
import type { GridReadyEvent, RowClickedEvent, ColDef } from "ag-grid-community";

import { ClientSideRowModelModule, ModuleRegistry } from "ag-grid-community";
ModuleRegistry.registerModules([ClientSideRowModelModule]);

import { themeBalham, colorSchemeDark, colorSchemeLight } from "ag-grid-community";

import { DatagridColDef } from "../../../../@types/searchbox";
import useStore from "../../../../store/useStore";

interface GridResultsProps<T> {
  loading: boolean;
  items: T[];
  columnDefs: DatagridColDef<T>[];
  onGridReady?: (params: GridReadyEvent) => void;
  onRowClicked: (event: RowClickedEvent) => void;
}

const themeLight = themeBalham.withPart(colorSchemeLight);
const themeDark = themeBalham.withPart(colorSchemeDark);

function GridResults<T>({ loading, items, columnDefs, onGridReady, onRowClicked }: GridResultsProps<T>) {
  const { userTheme } = useStore((store) => store);
  if (loading) {
    return <div style={{ padding: 16 }}>Caricamento...</div>;
  }

  if (!items || items.length === 0) {
    return <div style={{ padding: 16 }}>Nessun risultato</div>;
  }

  return (
    <div className="ag-theme-balham" style={{ width: "100%" }}>
      <AgGridReact
        theme={userTheme.mode === "light" ? themeLight : themeDark}
        rowData={items}
        columnDefs={columnDefs as unknown as ColDef<T, any>[]}
        onGridReady={onGridReady}
        onRowClicked={onRowClicked}
        rowSelection="single"
        domLayout="autoHeight"
      />
    </div>
  );
}

export default GridResults;
