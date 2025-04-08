/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgGridReact } from "ag-grid-react";
import type { GridReadyEvent, RowClickedEvent, ColDef } from "ag-grid-community";

// Registriamo i moduli necessari tramite ModuleRegistry
import { ClientSideRowModelModule, ModuleRegistry } from "ag-grid-community";
// import { ClientSideRowModelModule } from "ag-grid-community/client-side-row-model";
ModuleRegistry.registerModules([ClientSideRowModelModule]);

// Importa il tema Balham
import { themeBalham } from "ag-grid-community";

// Importa i CSS: usa il tema Balham
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-balham.css";
import { DatagridColDef } from "../../../../@types/searchbox";

interface GridResultsProps<T> {
  loading: boolean;
  items: T[];
  columnDefs: DatagridColDef<T>[]; // Se hai colonne tipizzate diversamente, adatta questo tipo
  onGridReady: (params: GridReadyEvent) => void;
  onRowClicked: (event: RowClickedEvent) => void;
}

function GridResults<T>({ loading, items, columnDefs, onGridReady, onRowClicked }: GridResultsProps<T>) {
  if (loading) {
    return <div style={{ padding: 16 }}>Caricamento...</div>;
  }

  if (!items || items.length === 0) {
    return <div style={{ padding: 16 }}>Nessun risultato</div>;
  }

  return (
    <div className="ag-theme-balham" style={{ width: "100%" }}>
      <AgGridReact
        theme={themeBalham}
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
