import { useMemo, useCallback, forwardRef } from "react";
import { Box, Typography } from "@mui/material";
import { GridReadyEvent } from "ag-grid-community";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";

interface SpesaRow extends Record<string, unknown> {
  spesaId: number;
  chiusuraId: number;
  descrizione: string;
  importo: number;
  categoria: CategoriaSpesa;
}

interface MonthlyExpensesDataGridProps {
  expenses: SpesaMensileLibera[];
  readOnly?: boolean;
}

const CATEGORIE_SPESA: CategoriaSpesa[] = ["Affitto", "Utenze", "Stipendi", "Altro"];

const toSpesaRow = (e: SpesaMensileLibera): SpesaRow => ({
  spesaId: e.spesaId,
  chiusuraId: e.chiusuraId,
  descrizione: e.descrizione,
  importo: e.importo,
  categoria: e.categoria,
});

const MonthlyExpensesDataGrid = forwardRef<GridReadyEvent<DatagridData<SpesaRow>>, MonthlyExpensesDataGridProps>(({ expenses, readOnly = false }, ref) => {
  const items = useMemo(() => expenses.map(toSpesaRow), [expenses]);

  const columnDefs = useMemo<DatagridColDef<SpesaRow>[]>(
    () => [
      {
        headerName: "Categoria",
        field: "categoria",
        editable: !readOnly,
        width: 150,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: CATEGORIE_SPESA },
      },
      {
        headerName: "Descrizione",
        field: "descrizione",
        editable: !readOnly,
        flex: 1,
      },
      {
        headerName: "Importo",
        field: "importo",
        editable: !readOnly,
        width: 120,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { min: 0, precision: 2 },
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => (params.value ? `€ ${Number(params.value).toFixed(2)}` : "€ 0.00"),
      },
    ],
    [readOnly]
  );

  const getNewRow = useCallback(
    (): SpesaRow => ({
      spesaId: -Date.now(),
      chiusuraId: expenses.length > 0 ? expenses[0].chiusuraId : 0,
      descrizione: "",
      importo: 0,
      categoria: "Altro",
    }),
    [expenses]
  );

  const handleGridReady = useCallback(
    (event: GridReadyEvent<DatagridData<SpesaRow>>) => {
      if (ref && typeof ref !== "function") {
        (ref as React.MutableRefObject<GridReadyEvent<DatagridData<SpesaRow>> | null>).current = event;
      }
    },
    [ref]
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 0 }}>
        Spese Mensili Libere
      </Typography>
      <Datagrid<SpesaRow>
        height="300px"
        items={items}
        columnDefs={columnDefs}
        readOnly={readOnly}
        getNewRow={getNewRow}
        getRowId={(params) => String(params.data.spesaId)}
        onGridReady={handleGridReady}
      />
    </Box>
  );
});

MonthlyExpensesDataGrid.displayName = "MonthlyExpensesDataGrid";

export default MonthlyExpensesDataGrid;
