import { useMemo, useState, forwardRef, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import { useFormikContext } from "formik";
import { z } from "zod";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, ValidationError, DatagridCellValueChangedEvent, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent } from "ag-grid-community";

interface Expense extends Record<string, unknown> {
  description: string;
  amount: number;
}

// Schema Zod per validazione inline non bloccante
const expenseSchema = z.object({
  description: z.string().min(1, "La descrizione è obbligatoria"),
  amount: z.number().min(0, "L'importo deve essere maggiore o uguale a 0"),
});

const ExpensesDataGrid = forwardRef<GridReadyEvent<DatagridData<Expense>>, object>((props, ref) => {
  const formik = useFormikContext<FormikCashRegisterValues>();
  const isLocked = formik.status?.isFormLocked || false;
  const [validationErrors, setValidationErrors] = useState<Map<number, ValidationError[]>>(new Map());

  // Calculate items from initial Formik values only
  const items = useMemo(() => {
    return formik.values.expenses || [];
  }, [formik.values.expenses]);

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
  }, []);

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<Expense>>) => {
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
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 2 }}>
        SPESE
      </Typography>
      <Box
        sx={{
          "& .ag-right-aligned-cell input": {
            textAlign: "right",
            paddingRight: "14px",
          },
        }}
      >
        <Datagrid
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
});

ExpensesDataGrid.displayName = "ExpensesDataGrid";

export default ExpensesDataGrid;
