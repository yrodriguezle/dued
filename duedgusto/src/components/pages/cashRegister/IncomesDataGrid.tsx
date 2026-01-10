import { useMemo, forwardRef, useCallback } from "react";
import { Box, Typography } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridCellValueChangedEvent, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent } from "ag-grid-community";

interface Income extends Record<string, unknown> {
  type: string;
  amount: number;
}

const IncomesDataGrid = forwardRef<GridReadyEvent<DatagridData<Income>>, object>((props, ref) => {
  const formik = useFormikContext<FormikCashRegisterValues>();
  const isLocked = formik.status?.isFormLocked || false;

  // Calculate items from initial Formik values only
  const items = useMemo(() => {
    return formik.values.incomes || [];
  }, [formik.values.incomes]);

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

  const handleCellValueChanged = useCallback((event: DatagridCellValueChangedEvent<Income>) => {
    const newAmount = parseFloat(event.newValue) || 0;
    if (newAmount >= 0 && event.data) {
      event.data.amount = newAmount;
    }
  }, []);

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<Income>>) => {
    if (ref && typeof ref !== 'function') {
      (ref as React.MutableRefObject<GridReadyEvent<DatagridData<Income>> | null>).current = event;
    }
  }, [ref]);

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
          items={items}
          columnDefs={columnDefs}
          readOnly={isLocked}
          getNewRow={() => ({ type: "", amount: 0 })}
          showRowNumbers={false}
          hideToolbar={true}
          onCellValueChanged={handleCellValueChanged}
          onGridReady={handleGridReady}
          suppressRowHoverHighlight={false}
        />
      </Box>
    </Box>
  );
});

IncomesDataGrid.displayName = "IncomesDataGrid";

export default IncomesDataGrid;
