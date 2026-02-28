import { useMemo, useCallback, forwardRef, useEffect, memo } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridCellValueChangedEvent, DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent } from "ag-grid-community";
import { CashCountRowData } from "./useCashCountData";

interface CashCountDataGridProps {
  rowData: CashCountRowData[];
  title: string;
  isLocked: boolean;
  onCellChange?: () => void;
  onCopyFromPrevious?: () => void;
}

const CashCountDataGrid = memo(
  forwardRef<GridReadyEvent<DatagridData<CashCountRowData>>, CashCountDataGridProps>(({ rowData, title, isLocked, onCellChange, onCopyFromPrevious }, ref) => {
    const theme = useTheme();

    const calculateTotal = useCallback((): number => {
      if (!ref || typeof ref === "function" || !ref.current) return 0;

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

    const handleCellValueChanged = useCallback(
      (event: DatagridCellValueChangedEvent<CashCountRowData>) => {
        const newQuantity = parseInt(event.newValue) || 0;
        if (newQuantity >= 0 && event.data) {
          // Aggiorna il totale della riga
          event.data.quantity = newQuantity;
          event.data.total = event.data.value * newQuantity;

          // Forza il refresh della riga modificata per aggiornare la colonna "Totale"
          if (event.node) {
            event.api.refreshCells({ rowNodes: [event.node], columns: ["total"], force: true });
          }

          // Aggiorna la riga pinnata del totale
          if (ref && typeof ref !== "function" && ref.current) {
            const pinnedNode = ref.current.api.getPinnedBottomRow(0);
            if (pinnedNode?.data) {
              pinnedNode.data.total = calculateTotal();
              ref.current.api.refreshCells({ rowNodes: [pinnedNode], force: true });
            }
          }
        }

        onCellChange?.();
      },
      [ref, calculateTotal, onCellChange]
    );

    const handleGridReady = useCallback(
      (event: GridReadyEvent<DatagridData<CashCountRowData>>) => {
        if (ref && typeof ref !== "function") {
          (ref as React.RefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>).current = event;
        }

        // Aggiorna il totale nella riga pinnata dopo che la griglia è pronta
        setTimeout(() => {
          if (ref && typeof ref !== "function" && ref.current) {
            const pinnedNode = ref.current.api.getPinnedBottomRow(0);
            if (pinnedNode?.data) {
              pinnedNode.data.total = calculateTotal();
              ref.current.api.refreshCells({ rowNodes: [pinnedNode], force: true });
            }
          }
        }, 0);
      },
      [ref, calculateTotal]
    );

    // Calcola il totale direttamente dai rowData
    const totalFromRowData = useMemo(() => {
      return rowData.reduce((sum, row) => sum + row.total, 0);
    }, [rowData]);

    // Riga pinnata per il totale
    const pinnedBottomRowData = useMemo<CashCountRowData[]>(
      () => [
        {
          denominationId: -999,
          type: "COIN" as const,
          value: 0,
          quantity: 0,
          total: totalFromRowData,
        },
      ],
      [totalFromRowData]
    );

    // Aggiorna la riga pinnata quando rowData cambia
    useEffect(() => {
      if (ref && typeof ref !== "function" && ref.current) {
        const pinnedNode = ref.current.api.getPinnedBottomRow(0);
        if (pinnedNode?.data) {
          pinnedNode.data.total = totalFromRowData;
          ref.current.api.refreshCells({ rowNodes: [pinnedNode], force: true });
        }
      }
    }, [ref, totalFromRowData]);

    const copyFromPreviousButton = useMemo(() => {
      if (!onCopyFromPrevious) return undefined;
      return (
        <Button
          size="small"
          variant="text"
          startIcon={<ContentCopyIcon />}
          disabled={isLocked}
          onClick={onCopyFromPrevious}
          sx={{
            minHeight: 0,
            height: 32,
            paddingY: 0.5,
            paddingX: 1.5,
            alignSelf: "center",
          }}
        >
          Copia da giorno prec.
        </Button>
      );
    }, [onCopyFromPrevious, isLocked]);

    return (
      <Box>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 0 }}>
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
              backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200],
            },
          }}
        >
          <Datagrid
            height="480px"
            items={rowData}
            columnDefs={columnDefs}
            readOnly={isLocked}
            showRowNumbers={false}
            hideToolbar={true}
            additionalToolbarButtons={copyFromPreviousButton}
            onGridReady={handleGridReady}
            onCellValueChanged={handleCellValueChanged}
            suppressRowHoverHighlight={false}
            defaultColDef={{ sortable: false, suppressMovable: true, resizable: true }}
            rowSelection={{ mode: "singleRow", enableClickSelection: false, checkboxes: false }}
            getRowId={(params) => params.data.denominationId.toString()}
            pinnedBottomRowData={pinnedBottomRowData}
            getRowStyle={(params) => {
              if (params.node.rowPinned) {
                return {
                  fontWeight: "bold",
                  backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200],
                };
              }
              return undefined;
            }}
          />
        </Box>
      </Box>
    );
  })
);

CashCountDataGrid.displayName = "CashCountDataGrid";

export default CashCountDataGrid;
