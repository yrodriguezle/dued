/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgGridReact } from "ag-grid-react";
import type { RowClickedEvent, ColDef } from "ag-grid-community";

import { ClientSideRowModelModule, ModuleRegistry } from "ag-grid-community";
ModuleRegistry.registerModules([ClientSideRowModelModule]);

import { themeQuartz, colorSchemeDark, colorSchemeLight } from "ag-grid-community";

import { DatagridColDef } from "../../../../@types/searchbox";
import useStore from "../../../../store/useStore";

export interface GridResultsProps<T> {
  loading: boolean;
  items: T[];
  columnDefs: DatagridColDef<T>[];
  onRowClicked: (event: RowClickedEvent) => void;
}

const themeLight = themeQuartz.withPart(colorSchemeLight);
const themeDark = themeQuartz.withPart(colorSchemeDark);

function GridResults<T>({ loading, items, columnDefs, onRowClicked }: GridResultsProps<T>) {
  const { userTheme } = useStore((store) => store);

  if (loading) {
    return <div style={{ padding: 16 }}>Caricamento...</div>;
  }

  return (
    <AgGridReact
      theme={userTheme.mode === "light" ? themeLight : themeDark}
      rowData={items}
      columnDefs={columnDefs as unknown as ColDef<T, any>[]}
      onRowClicked={onRowClicked}
      rowSelection="single"
      domLayout="autoHeight"
    />
  );
}

export default GridResults;
