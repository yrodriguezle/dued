import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef } from "../../common/datagrid/@types/Datagrid";

interface Expense {
  description: string;
  amount: number;
}

function ExpensesDataGrid() {
  const formik = useFormikContext<FormikCashRegisterValues>();
  const isLocked = formik.status?.isFormLocked || false;

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
          onCellValueChanged={handleCellValueChanged}
          suppressRowHoverHighlight={false}
        />
      </Box>
    </Box>
  );
}

export default ExpensesDataGrid;
