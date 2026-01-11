import { useMemo, useCallback, forwardRef } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridCellValueChangedEvent, DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent } from "ag-grid-community";
import { CashCountRowData } from "./useCashCountData";

interface CashCountDataGridProps {
  rowData: CashCountRowData[];
  title: string;
}

const CashCountDataGrid = forwardRef<GridReadyEvent<DatagridData<CashCountRowData>>, CashCountDataGridProps>(
  ({ rowData, title }, ref) => {
    const formik = useFormikContext<FormikCashRegisterValues>();
    const theme = useTheme();

    const isLocked = formik.status?.isFormLocked || false;

    const calculateTotal = useCallback((): number => {
      if (!ref || typeof ref === 'function' || !ref.current) return 0;

      let total = 0;
      ref.current.api.forEachNode((node) => {
        if (node.data && !node.rowPinned) {
          total += node.data.total;
        }
      });
      return total;
    }, [ref]);

    const columnDefs = useMemo<DatagridColDef<CashCountRowData>[]>(
      () => [
        {
          headerName: "Taglio",
          field: "value",
          flex: 1,
          editable: false,
          valueFormatter: (params) => {
            if (params.node?.rowPinned) {
              return "TOTALE";
            }
            return `${params.value.toFixed(2)}€`;
          },
        },
        {
          headerName: "Quantità",
          field: "quantity",
          flex: 1,
          editable: (params) => !isLocked && !params.node?.rowPinned,
          cellEditor: "agNumberCellEditor",
          cellEditorParams: {
            min: 0,
            precision: 0,
          },
          cellStyle: { textAlign: "right" },
          cellClass: "ag-right-aligned-cell",
          valueFormatter: (params) => {
            if (params.node?.rowPinned) {
              return "";
            }
            return params.value;
          },
        },
        {
          headerName: "Totale",
          field: "total",
          flex: 1,
          editable: false,
          cellStyle: (params) => {
            const style: Record<string, string> = { textAlign: "right" };
            if (params.node?.rowPinned) {
              style.fontSize = "1.25rem";
              style.color = theme.palette.primary.main;
            }
            return style;
          },
          valueFormatter: (params) => {
            return `${params.value.toFixed(2)}€`;
          },
        },
      ],
      [isLocked, theme]
    );

    const handleCellValueChanged = useCallback((event: DatagridCellValueChangedEvent<CashCountRowData>) => {
      const newQuantity = parseInt(event.newValue) || 0;
      if (newQuantity >= 0 && event.data) {
        // Aggiorna il totale della riga
        event.data.quantity = newQuantity;
        event.data.total = event.data.value * newQuantity;

        // Forza il refresh della riga modificata per aggiornare la colonna "Totale"
        if (event.node) {
          event.api.refreshCells({ rowNodes: [event.node], columns: ['total'], force: true });
        }

        // Aggiorna la riga pinnata del totale
        if (ref && typeof ref !== 'function' && ref.current) {
          const pinnedNode = ref.current.api.getPinnedBottomRow(0);
          if (pinnedNode?.data) {
            pinnedNode.data.total = calculateTotal();
            ref.current.api.refreshCells({ rowNodes: [pinnedNode], force: true });
          }
        }
      }
    }, [ref, calculateTotal]);

    const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<CashCountRowData>>) => {
      if (ref && typeof ref !== 'function') {
        (ref as React.MutableRefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>).current = event;
      }
    }, [ref]);

    // Riga pinnata per il totale
    const pinnedBottomRowData = useMemo<CashCountRowData[]>(
      () => [
        {
          denominationId: -999,
          type: "COIN" as const,
          value: 0,
          quantity: 0,
          total: calculateTotal(),
        },
      ],
      [calculateTotal]
    );

    return (
      <Box>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 2 }}>
          {title}
        </Typography>
        <Box
          sx={{
            "& .ag-right-aligned-cell input": {
              textAlign: "right",
              paddingRight: "14px",
            },
            "& .ag-row-pinned": {
              fontWeight: "bold",
              backgroundColor: theme.palette.mode === "dark"
                ? theme.palette.grey[800]
                : theme.palette.grey[200],
            },
          }}
        >
          <Datagrid
            height="480px"
            items={rowData}
            columnDefs={columnDefs}
            readOnly={isLocked}
            showRowNumbers={true}
            hideToolbar={true}
            onGridReady={handleGridReady}
            onCellValueChanged={handleCellValueChanged}
            suppressRowHoverHighlight={false}
            getRowId={(params) => params.data.denominationId.toString()}
            pinnedBottomRowData={pinnedBottomRowData}
            getRowStyle={(params) => {
              if (params.node.rowPinned) {
                return {
                  fontWeight: "bold",
                  backgroundColor: theme.palette.mode === "dark"
                    ? theme.palette.grey[800]
                    : theme.palette.grey[200],
                };
              }
              return undefined;
            }}
          />
        </Box>
      </Box>
    );
  });

CashCountDataGrid.displayName = "CashCountDataGrid";

export default CashCountDataGrid;
