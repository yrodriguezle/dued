import { useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useFormikContext } from "formik";
import { z } from "zod";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, ValidationError } from "../../common/datagrid/@types/Datagrid";

interface Expense {
  description: string;
  amount: number;
}

// Schema Zod per validazione inline non bloccante
const expenseSchema = z.object({
  description: z.string().min(1, "La descrizione è obbligatoria"),
  amount: z.number().min(0, "L'importo deve essere maggiore o uguale a 0"),
});

function ExpensesDataGrid() {
  const formik = useFormikContext<FormikCashRegisterValues>();
  const isLocked = formik.status?.isFormLocked || false;
  const [validationErrors, setValidationErrors] = useState<Map<number, ValidationError[]>>(new Map());

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

  const handleCellValueChanged = (event: any) => {
    const updatedExpenses = [...formik.values.expenses];
    updatedExpenses[event.node.rowIndex] = event.data;
    formik.setFieldValue("expenses", updatedExpenses);
  };

  const getNewExpense = (): Expense => ({
    description: "",
    amount: 0,
  });

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
          items={formik.values.expenses}
          columnDefs={columnDefs}
          readOnly={isLocked}
          getNewRow={getNewExpense}
          validationSchema={expenseSchema}
          onValidationErrors={setValidationErrors}
          showRowNumbers={true}
          onCellValueChanged={handleCellValueChanged}
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
}

export default ExpensesDataGrid;
