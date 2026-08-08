
import { useMemo, useState, forwardRef, useCallback, useRef, memo } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import PaymentIcon from "@mui/icons-material/Payment";
import EditIcon from "@mui/icons-material/Edit";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import dayjs from "dayjs";
import { z } from "zod";
import Datagrid from "../../common/datagrid/Datagrid";
import { withDatagridStatus } from "../../common/datagrid/datagridUtils";
import { DatagridStatus } from "../../../common/globals/constants";
import { DatagridColDef, ValidationError, DatagridCellValueChangedEvent, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent, RowDoubleClickedEvent, ICellRendererParams } from "ag-grid-community";
import formatCurrency from "../../../common/bones/formatCurrency";
import PagamentoFornitoreDialog from "./PagamentoFornitoreDialog";
import OverflowToolbar, { OverflowAction } from "../../common/toolbar/OverflowToolbar";
import useStore from "../../../store/useStore";

// Riga della griglia spese: superset di `Spese` (usato dalla cassa) con i campi
// aggiuntivi della chiusura mensile (data di competenza, categoria, id spesa
// libera, origine del pagamento). Tutti opzionali → la cassa resta compatibile.
export interface SpeseGridRow extends Spese {
  /** Giorno di competenza (YYYY-MM-DD). */
  data?: string;
  /** Categoria della spesa libera (solo chiusura). */
  categoria?: CategoriaSpesa;
  /** Id della spesa libera server (>0) oppure temporaneo (<0) per righe non salvate. */
  spesaId?: number;
  /** Registro cassa di appartenenza. Informativo: NON decide la modificabilità della riga. */
  registroCassaId?: number | null;
  /** Annotazione libera sulla riga, distinta dalla causale. */
  note?: string;
}

// Colonne opzionali abilitabili dal chiamante.
export interface SpeseDataGridColumns {
  /** Mostra la colonna "Data" (giorno di competenza). */
  showData?: boolean;
  /** Mostra la colonna "Categoria" con editor a tendina. */
  showCategoria?: boolean;
  /** Valori per la tendina categoria (default: Affitto/Utenze/Stipendi/Altro). */
  categoriaOptions?: CategoriaSpesa[];
  /** Mostra la colonna "Note" (annotazione libera, distinta dalla causale). */
  showNote?: boolean;
  /** Mostra il pulsante "Giornale" (default: attivo solo senza persistenza, cioè in cassa). */
  showGiornale?: boolean;
  /** Mostra l'azione "Pagamento fornitore", che crea documenti reali (default: true). */
  showPagamentoFornitore?: boolean;
  /**
   * Mostra la colonna "Pagamento" (contanti vs tracciato). È lei a decidere dove finisce
   * la riga: contanti → SpesaCassa, qualsiasi altro metodo → PagamentoFornitore senza documento.
   */
  showMetodoPagamento?: boolean;
  /** Categoria delle righe nuove (default: "Altro"). */
  defaultCategoria?: CategoriaSpesa;
}

/** Metodo di pagamento che classifica la riga come NON tracciata (contante di cassa). */
export const METODO_CONTANTI = "Contanti";

const DEFAULT_METODI_PAGAMENTO = [METODO_CONTANTI, "Bonifico", "Carta", "Assegno", "RID"];

// Callback di persistenza per-riga. Se assenti la griglia resta "staged" (cassa).
// create* ritorna l'id assegnato dal server per patchare la riga (anti doppio-insert).
export interface SpeseDataGridPersistence {
  createExpense: (row: SpeseGridRow) => Promise<number | null | void>;
  updateExpense: (row: SpeseGridRow) => Promise<void>;
  deleteExpense: (row: SpeseGridRow) => Promise<void>;
  createSupplierPayment: (row: SpeseGridRow) => Promise<number | null | void>;
  updateSupplierPayment: (row: SpeseGridRow) => Promise<void>;
  deleteSupplierPayment: (row: SpeseGridRow) => Promise<void>;
}

interface SpeseDataGridProps {
  initialExpenses: SpeseGridRow[];
  isLocked: boolean;
  // Data del registro/mese (YYYY-MM-DD): default per nuove righe e calcolo Giornale.
  date?: string;
  columns?: SpeseDataGridColumns;
  persistence?: SpeseDataGridPersistence;
  /**
   * Predicato che marca una riga pagamento come non modificabile in QUESTA griglia.
   * Assente (registro cassa) → nessun pagamento è read-only, comportamento invariato.
   * La read-only-ness è contestuale e va decisa dal chiamante: dopo il passaggio delle
   * spese sul registro giornaliero, `registroCassaId` è sempre valorizzato e non è più
   * un discriminante utilizzabile.
   */
  isPaymentReadOnly?: (row: SpeseGridRow) => boolean;
  onCellChange?: () => void;
  onExpensesChange?: (totalAmount: number, receiptAmount: number) => void;
}

// Importo giornale: configurabile da Impostazioni → Costo giornale.
// Questi valori restano solo come fallback se le impostazioni non sono ancora
// arrivate dal server, e coincidono con i default lato backend.
const GIORNALE_SATURDAY_FALLBACK = 5;
const GIORNALE_WEEKDAY_FALLBACK = 3.2;

const DEFAULT_CATEGORIE: CategoriaSpesa[] = ["Affitto", "Utenze", "Stipendi", "Altro"];

const speseSchema = z.object({
  description: z.string().min(1, "La descrizione è obbligatoria"),
  amount: z.number().min(0, "L'importo deve essere maggiore o uguale a 0"),
});

const SpeseDataGrid = memo(
  forwardRef<GridReadyEvent<DatagridData<SpeseGridRow>>, SpeseDataGridProps>(
    ({ initialExpenses, isLocked, date, columns, persistence, isPaymentReadOnly, onCellChange, onExpensesChange }, ref) => {
      const muiTheme = useTheme();
      const isSmallScreen = useMediaQuery(muiTheme.breakpoints.down("sm"));
      const isMobile = isSmallScreen && navigator.maxTouchPoints > 0;

      // Costo giornale da Impostazioni. `?? undefined` normalizza il null delle
      // impostazioni non ancora caricate, così il fallback scatta correttamente.
      const giornaleImportoSabato = useStore((state) => state.settings?.giornaleImportoSabato ?? undefined);
      const giornaleImportoFeriale = useStore((state) => state.settings?.giornaleImportoFeriale ?? undefined);

      const hasPersistence = !!persistence;
      const showData = !!columns?.showData;
      const showCategoria = !!columns?.showCategoria;
      const categoriaOptions = columns?.categoriaOptions ?? DEFAULT_CATEGORIE;
      // Giornale: attivo di default solo in cassa (nessuna persistenza per-riga).
      const showGiornale = columns?.showGiornale ?? !hasPersistence;
      const showPagamentoFornitore = columns?.showPagamentoFornitore ?? true;
      const showMetodoPagamento = !!columns?.showMetodoPagamento;
      const showNote = !!columns?.showNote;
      const defaultCategoria = columns?.defaultCategoria ?? "Altro";

      const [validationErrors, setValidationErrors] = useState<Map<number, ValidationError[]>>(new Map());
      const [dialogOpen, setDialogOpen] = useState(false);
      const [selectedCount, setSelectedCount] = useState(0);
      const [isEditing, setIsEditing] = useState(false);
      const [editingSpese, setEditingSpese] = useState<DatagridData<SpeseGridRow> | null>(null);
      const gridEventRef = useRef<GridReadyEvent<DatagridData<SpeseGridRow>> | null>(null);
      // Righe con create in corso: evita doppio insert se l'utente committa più celle
      // prima che il server risponda con l'id.
      const creatingRowsRef = useRef<Set<SpeseGridRow>>(new Set());

      // La modificabilità di un pagamento dipende dal contesto: la decide il chiamante.
      const isReadOnlyPayment = useCallback(
        (row?: SpeseGridRow | null) =>
          !!row?.isPagamentoFornitore && (isPaymentReadOnly?.(row) ?? false),
        [isPaymentReadOnly]
      );

      const reportExpenses = useCallback(
        (api: GridReadyEvent<DatagridData<SpeseGridRow>>["api"]) => {
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

      // Persistenza per-riga di una spesa libera (create/update). Ritorna dopo aver
      // eventualmente patchato lo spesaId assegnato dal server.
      const persistExpenseRow = useCallback(
        async (row: DatagridData<SpeseGridRow>) => {
          if (!persistence) return;
          // Una riga è già sul server se ha un id di spesa oppure di pagamento: con la
          // colonna Pagamento attiva la stessa riga può passare da una forma all'altra,
          // e a decidere quale mutation chiamare è il chiamante.
          if ((row.spesaId ?? 0) > 0 || (row.pagamentoId ?? 0) > 0) {
            await persistence.updateExpense(row);
            return;
          }
          if (!row.description?.trim()) return;
          if (creatingRowsRef.current.has(row)) return;
          creatingRowsRef.current.add(row);
          try {
            const newId = await persistence.createExpense(row);
            if (typeof newId === "number" && gridEventRef.current) {
              if (row.isPagamentoFornitore) row.pagamentoId = newId;
              else row.spesaId = newId;
              gridEventRef.current.api.applyTransaction({ update: [row] });
            }
          } finally {
            creatingRowsRef.current.delete(row);
          }
        },
        [persistence]
      );

      const handlePaymentConfirm = useCallback(
        (expense: Spese) => {
          const row = expense as SpeseGridRow;
          if (persistence) {
            // Persistenza per-riga: la griglia viene riallineata dal refetch del parent.
            if (editingSpese?.pagamentoId) {
              void persistence.updateSupplierPayment({ ...editingSpese, ...row });
            } else {
              void persistence.createSupplierPayment(row);
            }
          } else if (gridEventRef.current) {
            // Modalità staged (cassa): applyTransaction locale.
            if (editingSpese) {
              gridEventRef.current.api.applyTransaction({
                remove: [editingSpese],
                add: [withDatagridStatus(row, DatagridStatus.Unchanged)],
              });
            } else {
              gridEventRef.current.api.applyTransaction({ add: [withDatagridStatus(row, DatagridStatus.Unchanged)] });
            }
            reportExpenses(gridEventRef.current.api);
          }
          setEditingSpese(null);
          setDialogOpen(false);
          onCellChange?.();
        },
        [editingSpese, onCellChange, persistence, reportExpenses]
      );

      // Apre il dialog in modalità modifica per una riga fornitore (se editabile).
      // Dove il dialog è disattivato (chiusura mensile) le righe si modificano in linea:
      // il dialog pretende fornitore e documento, che una spesa fissa non ha.
      const openEditDialog = useCallback(
        (data: DatagridData<SpeseGridRow>) => {
          if (!showPagamentoFornitore || isLocked || isReadOnlyPayment(data)) return;
          setEditingSpese(data);
          setDialogOpen(true);
        },
        [showPagamentoFornitore, isLocked, isReadOnlyPayment]
      );

      const handleRowDoubleClicked = useCallback(
        (event: RowDoubleClickedEvent<DatagridData<SpeseGridRow>>) => {
          if (!event.data?.isPagamentoFornitore) return;
          openEditDialog(event.data);
        },
        [openEditDialog]
      );

      const items = useMemo(() => initialExpenses || [], [initialExpenses]);

      const columnDefs = useMemo<DatagridColDef<SpeseGridRow>[]>(() => {
        const defs: DatagridColDef<SpeseGridRow>[] = [];

        if (showData) {
          defs.push({
            headerName: "Data",
            field: "data",
            width: 120,
            minWidth: 110,
            // La "Data" è editabile anche sui pagamenti fornitore senza registro
            // (registroCassaId == null), via il callback di persistenza per-riga.
            // I pagamenti origine-cassa (registroCassaId != null) restano read-only.
            editable: (params) => !isLocked && !isReadOnlyPayment(params.data),
            cellEditor: "agDateStringCellEditor",
            valueFormatter: (params) => (params.value ? dayjs(params.value).format("DD/MM/YYYY") : ""),
          });
        }

        defs.push({
          headerName: "Tipo",
          field: "documentType",
          width: 120,
          minWidth: 100,
          editable: false,
          valueGetter: (params) => {
            if (params.data?.isPagamentoFornitore) {
              const senzaDocumento = params.data.fatturaId == null && params.data.ddtId == null;
              // Le spese fisse tracciate non hanno documento: etichettarle "DDT" mentirebbe.
              if (senzaDocumento) return showMetodoPagamento ? "" : "DDT";
              return params.data.documentType === "FA" ? "FA" : "DDT";
            }
            // In chiusura la categoria copre la classificazione → nessun "RIC".
            return showCategoria ? "" : "RIC";
          },
          cellRenderer: (params: ICellRendererParams<DatagridData<SpeseGridRow>>) => {
            const label = params.valueFormatted ?? params.value;
            const rowData = params.data;
            if (!showPagamentoFornitore || !rowData?.isPagamentoFornitore || isLocked || isReadOnlyPayment(rowData)) return label;
            return (
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer" }}
                onClick={() => openEditDialog(rowData)}
              >
                <EditIcon sx={{ fontSize: 14, color: "primary.main" }} />
                {label}
              </Box>
            );
          },
        });

        if (showCategoria) {
          defs.push({
            headerName: "Categoria",
            field: "categoria",
            width: 140,
            minWidth: 110,
            editable: (params) =>
              !isLocked
              && (showMetodoPagamento
                ? !isReadOnlyPayment(params.data)
                : !params.data?.isPagamentoFornitore),
            cellEditor: "agSelectCellEditor",
            cellEditorParams: { values: categoriaOptions },
            // Con la colonna Pagamento anche le righe tracciate hanno una categoria
            // significativa (è ciò che le distingue dai pagamenti documentali).
            valueGetter: (params) =>
              params.data?.isPagamentoFornitore && !showMetodoPagamento
                ? ""
                : params.data?.categoria ?? "",
          });
        }

        if (showMetodoPagamento) {
          defs.push({
            headerName: "Pagamento",
            field: "paymentMethod",
            width: 130,
            minWidth: 110,
            // Decide la destinazione della riga: Contanti → SpesaCassa, altro →
            // PagamentoFornitore senza documento. Sui pagamenti già legati a una fattura
            // o a un DDT il metodo si cambia dal documento, non da qui.
            editable: (params) => !isLocked && !isReadOnlyPayment(params.data),
            cellEditor: "agSelectCellEditor",
            cellEditorParams: { values: DEFAULT_METODI_PAGAMENTO },
            valueGetter: (params) => params.data?.paymentMethod ?? METODO_CONTANTI,
          });
        }

        defs.push({
          headerName: "Causale",
          field: "description",
          flex: 2,
          minWidth: 80,
          // In chiusura anche le spese fisse tracciate sono righe libere senza documento:
          // la causale resta editabile finché il pagamento non è read-only.
          editable: (params) =>
            !isLocked
            && (showMetodoPagamento
              ? !isReadOnlyPayment(params.data)
              : !params.data?.isPagamentoFornitore),
        });

        if (showNote) {
          defs.push({
            headerName: "Note",
            field: "note",
            flex: 2,
            minWidth: 100,
            // Stessa regola della Causale: e un'annotazione della riga, non del documento.
            editable: (params) =>
              !isLocked
              && (showMetodoPagamento
                ? !isReadOnlyPayment(params.data)
                : !params.data?.isPagamentoFornitore),
          });
        }

        defs.push({
          headerName: "Importo",
          field: "amount",
          flex: 1,
          minWidth: 70,
          editable: (params) =>
            !isLocked
            && (showMetodoPagamento
              ? !isReadOnlyPayment(params.data)
              : !params.data?.isPagamentoFornitore),
          cellEditor: "agNumberCellEditor",
          cellEditorParams: {
            min: 0,
            precision: 2,
          },
          cellStyle: { textAlign: "right" },
          cellClass: "ag-right-aligned-cell",
          valueFormatter: (params) => formatCurrency(params.value),
        });

        return defs;
      }, [isLocked, openEditDialog, showData, showCategoria, categoriaOptions, isReadOnlyPayment,
          showMetodoPagamento, showNote, showPagamentoFornitore]);

      const handleCellValueChanged = useCallback(
        (event: DatagridCellValueChangedEvent<SpeseGridRow>) => {
          if (event.data) {
            if (event.colDef.field === "amount") {
              const newAmount = parseFloat(String(event.newValue)) || 0;
              event.data.amount = Math.max(0, newAmount);
            }
            // Persistenza per-riga.
            if (persistence) {
              if (showMetodoPagamento) {
                // Con la colonna Pagamento la riga può cambiare natura (contanti ⇄ tracciata):
                // la griglia non prova a indovinare la mutation, delega al chiamante che
                // legge `paymentMethod` e converte se serve.
                if (!isReadOnlyPayment(event.data)) void persistExpenseRow(event.data);
              } else if (!event.data.isPagamentoFornitore) {
                // Spese libere: create/update tramite le mutation spesa libera.
                void persistExpenseRow(event.data);
              } else if (!isReadOnlyPayment(event.data) && event.data.pagamentoId != null) {
                // Pagamenti fornitore senza registro: l'unica colonna editabile è "Data",
                // quindi ogni modifica mappa sul callback di persistenza updateSupplierPayment.
                void persistence.updateSupplierPayment(event.data);
              }
            }
          }
          onCellChange?.();
          reportExpenses(event.api);
        },
        [isReadOnlyPayment, onCellChange, persistence, persistExpenseRow, reportExpenses, showMetodoPagamento]
      );

      const handleGridReady = useCallback(
        (event: GridReadyEvent<DatagridData<SpeseGridRow>>) => {
          gridEventRef.current = event;
          if (ref && typeof ref !== "function") {
            (ref as React.MutableRefObject<GridReadyEvent<DatagridData<SpeseGridRow>> | null>).current = event;
          }
          event.api.addEventListener("selectionChanged", () => {
            setSelectedCount(event.api.getSelectedRows().length);
          });
          event.api.addEventListener("cellEditingStarted", () => setIsEditing(true));
          event.api.addEventListener("cellEditingStopped", () => setIsEditing(false));
          reportExpenses(event.api);
        },
        [ref, reportExpenses]
      );

      const getNewExpense = useCallback((): SpeseGridRow => {
        const base: SpeseGridRow = { description: "", amount: 0 };
        if (showData) base.data = date || dayjs().format("YYYY-MM-DD");
        // In chiusura la categoria di default deve essere una di quelle mostrate:
        // una riga lasciata su "Altro" verrebbe filtrata via e sparirebbe al refetch.
        if (showCategoria) base.categoria = defaultCategoria;
        if (showMetodoPagamento) base.paymentMethod = METODO_CONTANTI;
        // Id temporaneo per il tracking riga quando la persistenza è attiva.
        if (hasPersistence) base.spesaId = -Date.now();
        return base;
      }, [date, showData, showCategoria, defaultCategoria, showMetodoPagamento, hasPersistence]);

      const handleAddRow = useCallback(() => {
        if (gridEventRef.current) {
          const result = gridEventRef.current.api.applyTransaction({ add: [withDatagridStatus(getNewExpense(), DatagridStatus.Unchanged)] });
          reportExpenses(gridEventRef.current.api);

          const newNode = result?.add?.[0];
          if (newNode?.rowIndex != null) {
            const rowIndex = newNode.rowIndex;
            gridEventRef.current.api.ensureIndexVisible(rowIndex);
            const firstEditable = showData ? "data" : "description";
            setTimeout(() => {
              if (gridEventRef.current) {
                gridEventRef.current.api.setFocusedCell(rowIndex, firstEditable);
                gridEventRef.current.api.startEditingCell({ rowIndex, colKey: firstEditable });
              }
            }, 1);
          }
        }
        onCellChange?.();
      }, [getNewExpense, onCellChange, reportExpenses, showData]);

      const handleDeleteSelected = useCallback(() => {
        if (!gridEventRef.current) return;
        const selected = gridEventRef.current.api.getSelectedRows() as DatagridData<SpeseGridRow>[];
        if (selected.length === 0) return;

        if (persistence) {
          // Persistenza per-riga: elimina lato server le righe già salvate; le righe
          // nuove non salvate vengono solo rimosse localmente. I pagamenti origine
          // cassa (read-only) sono ignorati.
          void Promise.all(
            selected.map(async (row) => {
              if (row.isPagamentoFornitore) {
                if (!isReadOnlyPayment(row) && row.pagamentoId) {
                  await persistence.deleteSupplierPayment(row);
                }
              } else if ((row.spesaId ?? 0) > 0) {
                await persistence.deleteExpense(row);
              }
            })
          );
          // Rimuove localmente le righe eliminabili (non i pagamenti read-only).
          const removable = selected.filter((row) => !isReadOnlyPayment(row));
          gridEventRef.current.api.applyTransaction({ remove: removable });
        } else {
          gridEventRef.current.api.applyTransaction({ remove: selected });
        }
        reportExpenses(gridEventRef.current.api);
        onCellChange?.();
      }, [isReadOnlyPayment, onCellChange, persistence, reportExpenses]);

      // Spesa "GIORNALE": importo dalle impostazioni, distinto tra sabato e altri giorni. Solo cassa.
      const handleAddGiornale = useCallback(() => {
        if (!gridEventRef.current || !date) return;
        const [year, month, day] = date.split("-").map(Number);
        const isSaturday = new Date(year, month - 1, day).getDay() === 6;
        const amount = isSaturday
          ? (giornaleImportoSabato ?? GIORNALE_SATURDAY_FALLBACK)
          : (giornaleImportoFeriale ?? GIORNALE_WEEKDAY_FALLBACK);
        const giornale: SpeseGridRow = { description: "GIORNALE", amount };
        gridEventRef.current.api.applyTransaction({ add: [withDatagridStatus(giornale, DatagridStatus.Unchanged)] });
        reportExpenses(gridEventRef.current.api);
        onCellChange?.();
      }, [date, onCellChange, reportExpenses, giornaleImportoSabato, giornaleImportoFeriale]);

      const toolbarActions = useMemo<OverflowAction[]>(() => {
        const actions: OverflowAction[] = [
          { key: "add", label: "Nuova riga", icon: <AddIcon fontSize="small" />, onClick: handleAddRow, disabled: isLocked || isEditing },
          { key: "delete", label: "Cancella riga", icon: <RemoveIcon fontSize="small" />, onClick: handleDeleteSelected, disabled: isLocked || selectedCount === 0 },
        ];
        if (showGiornale) {
          actions.push({ key: "giornale", label: "Giornale", icon: <MenuBookIcon fontSize="small" />, onClick: handleAddGiornale, disabled: isLocked || !date });
        }
        if (showPagamentoFornitore) {
          actions.push({ key: "fornitore", label: "Pagamento fornitore", icon: <PaymentIcon fontSize="small" />, onClick: () => setDialogOpen(true), disabled: isLocked });
        }
        return actions;
      }, [handleAddRow, handleDeleteSelected, handleAddGiornale, isLocked, isEditing, selectedCount, showGiornale, showPagamentoFornitore, date]);

      return (
        <Box>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ fontWeight: "bold", mb: 0 }}
          >
            SPESE
          </Typography>
          {/* Non montato quando il dialog è disattivato: apre comunque una query Apollo
              per l'anagrafica fornitori, inutile dove non lo si può aprire. */}
          {showPagamentoFornitore && (
            <PagamentoFornitoreDialog
              open={dialogOpen}
              onClose={() => {
                setDialogOpen(false);
                setEditingSpese(null);
              }}
              onConfirm={handlePaymentConfirm}
              initialData={editingSpese ?? undefined}
            />
          )}
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
            <Datagrid<SpeseGridRow>
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
    }
  )
);

SpeseDataGrid.displayName = "ExpensesDataGrid";

export default SpeseDataGrid;
