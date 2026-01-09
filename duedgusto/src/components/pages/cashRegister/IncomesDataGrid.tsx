import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef } from "../../common/datagrid/@types/Datagrid";

interface Income extends Record<string, unknown> {
  type: string;
  amount: number;
}

function IncomesDataGrid() {
  const formik = useFormikContext<FormikCashRegisterValues>();
  const isLocked = formik.status?.isFormLocked || false;

  const columnDefs = useMemo<DatagridColDef<Income>[]>(
    () => [
      {
        headerName: "Tipo",
        field: "type",
        flex: 2,
        editable: false,
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
    const updatedIncomes = formik.values.incomes.map((income, index) =>
      index === event.node.rowIndex
        ? { ...income, amount: event.newValue || 0 }
        : income
    );
    formik.setFieldValue("incomes", updatedIncomes);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 2 }}>
        INCASSI
      </Typography>
      <Box
        sx={{
          "& .ag-right-aligned-cell input": {
            textAlign: "right",
            paddingRight: "14px",
          },
        }}
      >
        <Datagrid<Income>
          height="200px"
          items={formik.values.incomes}
          columnDefs={columnDefs}
          readOnly={isLocked}
          getNewRow={() => ({ type: "", amount: 0 })}
          showRowNumbers={false}
          hideToolbar={true}
          onCellValueChanged={handleCellValueChanged}
          suppressRowHoverHighlight={false}
        />
      </Box>
    </Box>
  );
}

export default IncomesDataGrid;
