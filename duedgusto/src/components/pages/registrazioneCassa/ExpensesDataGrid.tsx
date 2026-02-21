import { useMemo, useState, forwardRef, useCallback, useRef, memo } from "react";
import { Box, Button, Typography } from "@mui/material";
import PaymentIcon from "@mui/icons-material/Payment";
import { z } from "zod";
import { Expense } from "./CashRegisterDetails";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, ValidationError, DatagridCellValueChangedEvent, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent } from "ag-grid-community";
import SupplierPaymentDialog from "./SupplierPaymentDialog";

interface ExpensesDataGridProps {
  initialExpenses: Expense[];
  isLocked: boolean;
  onCellChange?: () => void;
}

// Schema Zod per validazione inline non bloccante
const expenseSchema = z.object({
  description: z.string().min(1, "La descrizione è obbligatoria"),
  amount: z.number().min(0, "L'importo deve essere maggiore o uguale a 0"),
});

const ExpensesDataGrid = memo(forwardRef<GridReadyEvent<DatagridData<Expense>>, ExpensesDataGridProps>(({ initialExpenses, isLocked, onCellChange }, ref) => {
  const [validationErrors, setValidationErrors] = useState<Map<number, ValidationError[]>>(new Map());
  const [dialogOpen, setDialogOpen] = useState(false);
  const gridEventRef = useRef<GridReadyEvent<DatagridData<Expense>> | null>(null);

  const handlePaymentConfirm = useCallback((expense: { description: string; amount: number }) => {
    if (gridEventRef.current) {
      gridEventRef.current.api.applyTransaction({ add: [expense as DatagridData<Expense>] });
    }
    setDialogOpen(false);
    onCellChange?.();
  }, [onCellChange]);

  // Usa i dati iniziali passati come prop
  const items = useMemo(() => {
    return initialExpenses || [];
  }, [initialExpenses]);

  const columnDefs = useMemo<DatagridColDef<Expense>[]>(
    () => [
      {
        headerName: "Causale",
        field: "description",
        flex: 2,
        editable: !isLocked,
      },
      {
        headerName: "Importo (€)",
        field: "amount",
        flex: 1,
        editable: !isLocked,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: {
          min: 0,
          precision: 2,
        },
        cellStyle: { textAlign: "right" },
        cellClass: "ag-right-aligned-cell",
        valueFormatter: (params) => {
          if (params.value == null) return "0.00€";
          return `${Number(params.value).toFixed(2)}€`;
        },
      },
    ],
    [isLocked]
  );

  const handleCellValueChanged = useCallback((event: DatagridCellValueChangedEvent<Expense>) => {
    if (event.data) {
      // Data is already updated by AG Grid, no need to manually update
      // Just ensure values are valid
      if (event.colDef.field === "amount") {
        const newAmount = parseFloat(event.newValue) || 0;
        event.data.amount = Math.max(0, newAmount);
      }
    }
    onCellChange?.();
  }, [onCellChange]);

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<Expense>>) => {
    gridEventRef.current = event;
    if (ref && typeof ref !== 'function') {
      (ref as React.MutableRefObject<GridReadyEvent<DatagridData<Expense>> | null>).current = event;
    }
  }, [ref]);

  const getNewExpense = useCallback((): Expense => ({
    description: "",
    amount: 0,
  }), []);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 0 }}>
          SPESE
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PaymentIcon />}
          disabled={isLocked}
          onClick={() => setDialogOpen(true)}
        >
          Paga Fornitore
        </Button>
      </Box>
      <SupplierPaymentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={handlePaymentConfirm}
      />
      <Box
        sx={{
          "& .ag-right-aligned-cell input": {
            textAlign: "right",
            paddingRight: "14px",
          },
        }}
      >
        <Datagrid<Expense>
          height="300px"
          items={items}
          columnDefs={columnDefs}
          readOnly={isLocked}
          getNewRow={getNewExpense}
          validationSchema={expenseSchema}
          onValidationErrors={setValidationErrors}
          showRowNumbers={true}
          onCellValueChanged={handleCellValueChanged}
          onGridReady={handleGridReady}
          suppressRowHoverHighlight={false}
          defaultColDef={{ sortable: false, suppressMovable: true, resizable: true }}
        />
      </Box>
      {validationErrors.size > 0 && (
        <Box sx={{ mt: 1 }}>
          {Array.from(validationErrors.entries()).map(([rowIndex, errors]) => (
            <Typography key={rowIndex} color="error" variant="caption" display="block">
              Riga {rowIndex + 1}: {errors.map((e) => e.message).join(", ")}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}));

ExpensesDataGrid.displayName = "ExpensesDataGrid";

export default ExpensesDataGrid;
