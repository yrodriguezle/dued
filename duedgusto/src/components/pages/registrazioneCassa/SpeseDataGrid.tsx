
import { useMemo, useState, forwardRef, useCallback, useRef, memo } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import PaymentIcon from "@mui/icons-material/Payment";
import EditIcon from "@mui/icons-material/Edit";
import { z } from "zod";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, ValidationError, DatagridCellValueChangedEvent, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent, RowDoubleClickedEvent, ICellRendererParams } from "ag-grid-community";
import formatCurrency from "../../../common/bones/formatCurrency";
import PagamentoFornitoreDialog from "./PagamentoFornitoreDialog";
import OverflowToolbar, { OverflowAction } from "../../common/toolbar/OverflowToolbar";

interface SpeseDataGridProps {
  initialExpenses: Spese[];
  isLocked: boolean;
  onCellChange?: () => void;
  onExpensesChange?: (totalAmount: number, receiptAmount: number) => void;
}

const speseSchema = z.object({
  description: z.string().min(1, "La descrizione è obbligatoria"),
  amount: z.number().min(0, "L'importo deve essere maggiore o uguale a 0"),
});

const SpeseDataGrid = memo(
  forwardRef<GridReadyEvent<DatagridData<Spese>>, SpeseDataGridProps>(({ initialExpenses, isLocked, onCellChange, onExpensesChange }, ref) => {
    const muiTheme = useTheme();
    const isSmallScreen = useMediaQuery(muiTheme.breakpoints.down("sm"));
    const isMobile = isSmallScreen && navigator.maxTouchPoints > 0;

    const [validationErrors, setValidationErrors] = useState<Map<number, ValidationError[]>>(new Map());
    const [dialogOpen, setDialogOpen] = useState(false);
    // Spesa in fase di modifica (null = modalità aggiunta)
    const [editingSpese, setEditingSpese] = useState<Spese | null>(null);
    const gridEventRef = useRef<GridReadyEvent<DatagridData<Spese>> | null>(null);

    const reportExpenses = useCallback(
      (api: GridReadyEvent<DatagridData<Spese>>["api"]) => {
        if (!onExpensesChange) return;
        let total = 0;
        let receiptTotal = 0;
        api.forEachNode((node) => {
          if (node.data) {
            total += node.data.amount || 0;
            if (!node.data.isPagamentoFornitore) {
              receiptTotal += node.data.amount || 0;
            }
          }
        });
        onExpensesChange(total, receiptTotal);
      },
      [onExpensesChange]
    );

    const handlePaymentConfirm = useCallback(
      (expense: Spese) => {
        if (gridEventRef.current) {
          if (editingSpese) {
            // Modalità modifica: rimuove la riga vecchia e aggiunge quella aggiornata
            gridEventRef.current.api.applyTransaction({
              remove: [editingSpese as DatagridData<Spese>],
              add: [expense as DatagridData<Spese>],
            });
          } else {
            // Modalità aggiunta: inserisce la nuova riga
            gridEventRef.current.api.applyTransaction({ add: [expense as DatagridData<Spese>] });
          }
          reportExpenses(gridEventRef.current.api);
        }
        setEditingSpese(null);
        setDialogOpen(false);
        onCellChange?.();
      },
      [editingSpese, onCellChange, reportExpenses]
    );

    // Apre il dialog in modalità modifica per una riga fornitore
    const openEditDialog = useCallback(
      (data: Spese) => {
        if (isLocked) return;
        setEditingSpese(data);
        setDialogOpen(true);
      },
      [isLocked]
    );

    // Doppio click su riga fornitore (fallback desktop)
    const handleRowDoubleClicked = useCallback(
      (event: RowDoubleClickedEvent<DatagridData<Spese>>) => {
        if (!event.data?.isPagamentoFornitore) return;
        openEditDialog(event.data as Spese);
      },
      [openEditDialog]
    );

    // Usa i dati iniziali passati come prop
    const items = useMemo(() => {
      return initialExpenses || [];
    }, [initialExpenses]);

    const columnDefs = useMemo<DatagridColDef<Spese>[]>(
      () => [
        {
          headerName: "Tipo",
          field: "documentType",
          width: 120,
          minWidth: 120,
          editable: false,
          valueGetter: (params) => {
            if (params.data?.isPagamentoFornitore) {
              return params.data.documentType === "FA" ? "FA" : "DDT";
            }
            return "RIC";
          },
          cellRenderer: (params: ICellRendererParams<DatagridData<Spese>>) => {
            const label = params.valueFormatted ?? params.value;
            if (!params.data?.isPagamentoFornitore || isLocked) return label;
            return (
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}
                onClick={() => openEditDialog(params.data as Spese)}
              >
                <EditIcon sx={{ fontSize: 14, color: "primary.main" }} />
                {label}
              </Box>
            );
          },
        },
        {
          headerName: "Causale",
          field: "description",
          flex: 2,
          minWidth: 80,
          editable: (params) => !isLocked && !params.data?.isPagamentoFornitore,
        },
        {
          headerName: "Importo",
          field: "amount",
          flex: 1,
          minWidth: 70,
          editable: (params) => !isLocked && !params.data?.isPagamentoFornitore,
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
      [isLocked, openEditDialog]
    );

    const handleCellValueChanged = useCallback(
      (event: DatagridCellValueChangedEvent<Spese>) => {
        if (event.data) {
          if (event.colDef.field === "amount") {
            const newAmount = parseFloat(event.newValue) || 0;
            event.data.amount = Math.max(0, newAmount);
          }
        }
        onCellChange?.();
        reportExpenses(event.api);
      },
      [onCellChange, reportExpenses]
    );

    const handleGridReady = useCallback(
      (event: GridReadyEvent<DatagridData<Spese>>) => {
        gridEventRef.current = event;
        if (ref && typeof ref !== "function") {
          (ref as React.MutableRefObject<GridReadyEvent<DatagridData<Spese>> | null>).current = event;
        }
        reportExpenses(event.api);
      },
      [ref, reportExpenses]
    );

    const getNewExpense = useCallback(
      (): Spese => ({
        description: "",
        amount: 0,
      }),
      []
    );

    const handleAddRow = useCallback(() => {
      if (gridEventRef.current) {
        const result = gridEventRef.current.api.applyTransaction({ add: [{ description: "", amount: 0 } as DatagridData<Spese>] });
        reportExpenses(gridEventRef.current.api);

        // Avvia editing sulla prima cella editabile della nuova riga
        const newNode = result?.add?.[0];
        if (newNode?.rowIndex != null) {
          const rowIndex = newNode.rowIndex;
          gridEventRef.current.api.ensureIndexVisible(rowIndex);
          setTimeout(() => {
            if (gridEventRef.current) {
              gridEventRef.current.api.setFocusedCell(rowIndex, "description");
              gridEventRef.current.api.startEditingCell({ rowIndex, colKey: "description" });
            }
          }, 1);
        }
      }
      onCellChange?.();
    }, [onCellChange, reportExpenses]);

    const handleDeleteSelected = useCallback(() => {
      if (gridEventRef.current) {
        const selected = gridEventRef.current.api.getSelectedRows();
        if (selected.length > 0) {
          gridEventRef.current.api.applyTransaction({ remove: selected });
          reportExpenses(gridEventRef.current.api);
          onCellChange?.();
        }
      }
    }, [onCellChange, reportExpenses]);

    const toolbarActions = useMemo<OverflowAction[]>(
      () => [
        { key: "add", label: "Nuova riga", icon: <AddIcon fontSize="small" />, onClick: handleAddRow, disabled: isLocked },
        { key: "delete", label: "Cancella riga", icon: <RemoveIcon fontSize="small" />, onClick: handleDeleteSelected, disabled: isLocked },
        { key: "fornitore", label: "Pagamento fornitore", icon: <PaymentIcon fontSize="small" />, onClick: () => setDialogOpen(true), disabled: isLocked },
      ],
      [handleAddRow, handleDeleteSelected, isLocked]
    );

    return (
      <Box>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ fontWeight: "bold", mb: 0 }}
        >
          SPESE
        </Typography>
        <PagamentoFornitoreDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditingSpese(null); }}
          onConfirm={handlePaymentConfirm}
          initialData={editingSpese ?? undefined}
        />
        <Box
          sx={{
            minWidth: 0,
            overflow: "hidden",
            "& .ag-right-aligned-cell input": {
              textAlign: "right",
              paddingRight: "14px",
            },
          }}
        >
          <Datagrid<Spese>
            gridId="expenses"
            height="300px"
            items={items}
            columnDefs={columnDefs}
            readOnly={isLocked}
            rowSelection={{ mode: "multiRow" }}
            getNewRow={getNewExpense}
            additionalToolbarButtons={<OverflowToolbar
              actions={toolbarActions}
              iconOnly={isMobile}
            />}
            hideToolbar={true}
            validationSchema={speseSchema}
            onValidationErrors={setValidationErrors}
            showRowNumbers={true}
            onCellValueChanged={handleCellValueChanged}
            onGridReady={handleGridReady}
            onRowDoubleClicked={handleRowDoubleClicked}
            suppressRowHoverHighlight={false}
            defaultColDef={{ sortable: false, suppressMovable: true, resizable: true, minWidth: 50 }}
          />
        </Box>
        {validationErrors.size > 0 && (
          <Box sx={{ mt: 1 }}>
            {Array.from(validationErrors.entries()).map(([rowIndex, errors]) => (
              <Typography
                key={rowIndex}
                color="error"
                variant="caption"
                display="block"
              >
                Riga {rowIndex + 1}: {errors.map((e) => e.message).join(", ")}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    );
  })
);

SpeseDataGrid.displayName = "ExpensesDataGrid";

export default SpeseDataGrid;
