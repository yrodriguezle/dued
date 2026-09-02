import { useMemo, forwardRef, useCallback, useEffect, memo } from "react";
import { Box, Typography } from "@mui/material";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridCellValueChangedEvent, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent } from "ag-grid-community";
import formatCurrency from "../../../common/bones/formatCurrency";

interface IncomesDataGridProps {
  initialIncomes: Income[];
  isLocked: boolean;
  onCellChange?: () => void;
  onIncomesChange?: (incomes: IncassiGiornalieri[]) => void;
  onExitGrid?: () => void;
}

const toIncassi = (rows: Income[]): IncassiGiornalieri[] => rows.map((row) => ({ tipo: row.type, importo: row.amount }));

const IncomesDataGrid = memo(
  forwardRef<GridReadyEvent<DatagridData<Income>>, IncomesDataGridProps>(({ initialIncomes, isLocked, onCellChange, onIncomesChange, onExitGrid }, ref) => {
    // Usa i dati iniziali passati come prop
    const items = useMemo(() => {
      return initialIncomes || [];
    }, [initialIncomes]);

    const columnDefs = useMemo<DatagridColDef<Income>[]>(
      () => [
        {
          headerName: "Tipo",
          field: "type",
          flex: 2,
          editable: false,
        },
        {
          headerName: "Importo",
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
            return formatCurrency(params.value);
          },
        },
      ],
      [isLocked]
    );

    const reportIncomes = useCallback(
      (api: GridReadyEvent<DatagridData<Income>>["api"]) => {
        if (!onIncomesChange) return;
        const entries: Income[] = [];
        api.forEachNode((node) => {
          if (node.data) {
            entries.push(node.data);
          }
        });
        onIncomesChange(toIncassi(entries));
      },
      [onIncomesChange]
    );

    // Cambiando giorno la griglia NON si rimonta (Apollo serve dalla cache quando si
    // torna su un giorno già visitato, quindi il parent non passa dallo stato di
    // caricamento): senza questo effetto onGridReady non riparte e il riepilogo
    // resterebbe fermo sugli incassi del giorno precedente.
    useEffect(() => {
      onIncomesChange?.(toIncassi(items));
    }, [items, onIncomesChange]);

    const handleCellValueChanged = useCallback(
      (event: DatagridCellValueChangedEvent<Income>) => {
        const newAmount = parseFloat(event.newValue) || 0;
        if (newAmount >= 0 && event.data) {
          event.data.amount = newAmount;
        }
        onCellChange?.();
        reportIncomes(event.api);
      },
      [onCellChange, reportIncomes]
    );

    const handleGridReady = useCallback(
      (event: GridReadyEvent<DatagridData<Income>>) => {
        if (ref && typeof ref !== "function") {
          (ref as React.MutableRefObject<GridReadyEvent<DatagridData<Income>> | null>).current = event;
        }
        reportIncomes(event.api);
      },
      [ref, reportIncomes]
    );

    return (
      <Box>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ fontWeight: "bold", mb: 0 }}
        >
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
            gridId="incomes"
            height="200px"
            items={items}
            columnDefs={columnDefs}
            readOnly={isLocked}
            getNewRow={() => ({ type: "", amount: 0 })}
            autoAddRowOnTab={false}
            showRowNumbers={false}
            hideToolbar={true}
            onExitGrid={onExitGrid}
            onCellValueChanged={handleCellValueChanged}
            onGridReady={handleGridReady}
            suppressRowHoverHighlight={false}
            defaultColDef={{ sortable: false, suppressMovable: true, resizable: true, minWidth: 50 }}
            rowSelection={{ mode: "singleRow", enableClickSelection: false, checkboxes: false }}
          />
        </Box>
      </Box>
    );
  })
);

IncomesDataGrid.displayName = "IncomesDataGrid";

export default IncomesDataGrid;
