
import { useMemo, useState, forwardRef, useCallback, useRef, memo } from "react";
import { Box, Typography } from "@mui/material";
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

interface ExpensesDataGridProps {
  initialExpenses: Expense[];
  isLocked: boolean;
  onCellChange?: () => void;
  onExpensesChange?: (totalAmount: number, receiptAmount: number) => void;
}

// Schema Zod per validazione inline non bloccante
const expenseSchema = z.object({
  description: z.string().min(1, "La descrizione è obbligatoria"),
  amount: z.number().min(0, "L'importo deve essere maggiore o uguale a 0"),
});

const ExpensesDataGrid = memo(
  forwardRef<GridReadyEvent<DatagridData<Expense>>, ExpensesDataGridProps>(({ initialExpenses, isLocked, onCellChange, onExpensesChange }, ref) => {
    const [validationErrors, setValidationErrors] = useState<Map<number, ValidationError[]>>(new Map());
    const [dialogOpen, setDialogOpen] = useState(false);
    // Spesa in fase di modifica (null = modalità aggiunta)
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const gridEventRef = useRef<GridReadyEvent<DatagridData<Expense>> | null>(null);

    const reportExpenses = useCallback(
      (api: GridReadyEvent<DatagridData<Expense>>["api"]) => {
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
      (expense: Expense) => {
        if (gridEventRef.current) {
          if (editingExpense) {
            // Modalità modifica: rimuove la riga vecchia e aggiunge quella aggiornata
            gridEventRef.current.api.applyTransaction({
              remove: [editingExpense as DatagridData<Expense>],
              add: [expense as DatagridData<Expense>],
            });
          } else {
            // Modalità aggiunta: inserisce la nuova riga
            gridEventRef.current.api.applyTransaction({ add: [expense as DatagridData<Expense>] });
          }
          reportExpenses(gridEventRef.current.api);
        }
        setEditingExpense(null);
        setDialogOpen(false);
        onCellChange?.();
      },
      [editingExpense, onCellChange, reportExpenses]
    );

    // Apre il dialog in modalità modifica per una riga fornitore
    const openEditDialog = useCallback(
      (data: Expense) => {
        if (isLocked) return;
        setEditingExpense(data);
        setDialogOpen(true);
      },
      [isLocked]
    );

    // Doppio click su riga fornitore (fallback desktop)
    const handleRowDoubleClicked = useCallback(
      (event: RowDoubleClickedEvent<DatagridData<Expense>>) => {
        if (!event.data?.isPagamentoFornitore) return;
        openEditDialog(event.data as Expense);
      },
      [openEditDialog]
    );

    // Usa i dati iniziali passati come prop
    const items = useMemo(() => {
      return initialExpenses || [];
    }, [initialExpenses]);

    const columnDefs = useMemo<DatagridColDef<Expense>[]>(
      () => [
        {
          headerName: "Tipo",
          field: "documentType",
          width: 85,
          minWidth: 60,
          editable: false,
          valueGetter: (params) => {
            if (params.data?.isPagamentoFornitore) {
              return params.data.documentType === "FA" ? "FA" : "DDT";
            }
            return "RIC";
          },
          cellRenderer: (params: ICellRendererParams<DatagridData<Expense>>) => {
            const label = params.valueFormatted ?? params.value;
            if (!params.data?.isPagamentoFornitore || isLocked) return label;
            return (
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}
                onClick={() => openEditDialog(params.data as Expense)}
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
      (event: DatagridCellValueChangedEvent<Expense>) => {
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
      (event: GridReadyEvent<DatagridData<Expense>>) => {
        gridEventRef.current = event;
        if (ref && typeof ref !== "function") {
          (ref as React.MutableRefObject<GridReadyEvent<DatagridData<Expense>> | null>).current = event;
        }
        reportExpenses(event.api);
      },
      [ref, reportExpenses]
    );

    const getNewExpense = useCallback(
      (): Expense => ({
        description: "",
        amount: 0,
      }),
      []
    );

    const handleAddRow = useCallback(() => {
      if (gridEventRef.current) {
        gridEventRef.current.api.applyTransaction({ add: [{ description: "", amount: 0 } as DatagridData<Expense>] });
        reportExpenses(gridEventRef.current.api);
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
          onClose={() => { setDialogOpen(false); setEditingExpense(null); }}
          onConfirm={handlePaymentConfirm}
          initialData={editingExpense ?? undefined}
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
          <Datagrid<Expense>
            gridId="expenses"
            height="300px"
            items={items}
            columnDefs={columnDefs}
            readOnly={isLocked}
            rowSelection={{ mode: "multiRow" }}
            getNewRow={getNewExpense}
            additionalToolbarButtons={<OverflowToolbar actions={toolbarActions} />}
            hideToolbar={true}
            validationSchema={expenseSchema}
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

ExpensesDataGrid.displayName = "ExpensesDataGrid";

export default ExpensesDataGrid;
