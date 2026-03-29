import { useCallback, useEffect, useMemo, useRef } from "react";
import { Paper, Box, useTheme } from "@mui/material";
import { useFormikContext } from "formik";
import { useMutation } from "@apollo/client";
import { CellValueChangedEvent, GridReadyEvent } from "ag-grid-community";

import FormikDateField from "../../common/form/FormikDateField";
import FormikNumberField from "../../common/form/FormikNumberField";
import FormikTextField from "../../common/form/FormikTextField";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import fornitoreSearchboxOption, { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import fatturaAcquistoSearchboxOption, { FatturaAcquistoSearchbox } from "../../common/form/searchbox/searchboxOptions/fatturaAcquistoSearchboxOptions";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { formStatuses } from "../../../common/globals/constants";
import showToast from "../../../common/toast/showToast";
import { mutationMutatePagamentoFornitore } from "../../../graphql/fornitori/mutations";
import { FormikDocumentoTrasportoValues } from "./DocumentoTrasportoDetails";

export type PaymentRow = {
  paymentId: number;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  notes: string;
};

interface DocumentoTrasportoFormProps {
  onSelectFornitore: (item: FornitoreSearchbox) => void;
  onSelectInvoice: (item: FatturaAcquistoSearchbox) => void;
  payments: PagamentoFornitore[];
  onRefresh: () => void;
  onRegisterGetPaymentRows?: (getter: () => PaymentRow[]) => void;
}

function DocumentoTrasportoForm({ onSelectFornitore, onSelectInvoice, payments, onRefresh, onRegisterGetPaymentRows }: DocumentoTrasportoFormProps) {
  const { values, status: formStatus } = useFormikContext<FormikDocumentoTrasportoValues>();
  const isUpdate = formStatus?.formStatus === formStatuses.UPDATE;
  const theme = useTheme();
  const dateColorScheme = theme.palette.mode === "dark" ? "dark" : "light";

  const [mutatePayment] = useMutation(mutationMutatePagamentoFornitore);

  // Ref alla grid API dei pagamenti per leggere i dati in INSERT mode
  const paymentGridApiRef = useRef<GridReadyEvent<DatagridData<PaymentRow>>["api"] | null>(null);

  const handlePaymentGridReady = useCallback((event: GridReadyEvent<DatagridData<PaymentRow>>) => {
    paymentGridApiRef.current = event.api;
  }, []);

  // Registra getter per leggere le righe pagamenti dalla griglia (usato dal Details in INSERT)
  useEffect(() => {
    if (!onRegisterGetPaymentRows) return;
    onRegisterGetPaymentRows(() => {
      if (!paymentGridApiRef.current) return [];
      const rows: PaymentRow[] = [];
      paymentGridApiRef.current.forEachNode((node) => {
        if (node.data && node.data.amount > 0) {
          rows.push({
            paymentId: node.data.paymentId,
            paymentDate: node.data.paymentDate,
            amount: Number(node.data.amount),
            paymentMethod: node.data.paymentMethod,
            notes: node.data.notes,
          });
        }
      });
      return rows;
    });
  }, [onRegisterGetPaymentRows]);

  // === Payments Grid ===
  const paymentItems = useMemo<PaymentRow[]>(
    () =>
      payments.map((p) => ({
        paymentId: p.pagamentoId,
        paymentDate: p.dataPagamento ? p.dataPagamento.split("T")[0] : "",
        amount: p.importo,
        paymentMethod: p.metodoPagamento ?? "",
        notes: p.note ?? "",
      })),
    [payments]
  );

  const paymentColumnDefs = useMemo<DatagridColDef<PaymentRow>[]>(
    () => [
      { headerName: "Data Pagamento", field: "paymentDate", editable: true, flex: 1, cellEditor: "agDateStringCellEditor" },
      {
        headerName: "Importo",
        field: "amount",
        editable: true,
        width: 130,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { precision: 2 },
        valueFormatter: (params) => (params.value != null ? Number(params.value).toFixed(2) : ""),
      },
      { headerName: "Metodo Pagamento", field: "paymentMethod", editable: true, flex: 1 },
      { headerName: "Note", field: "notes", editable: true, flex: 1 },
    ],
    []
  );

  const getNewPaymentRow = useCallback(
    (): PaymentRow => ({
      paymentId: 0,
      paymentDate: new Date().toISOString().split("T")[0],
      amount: 0,
      paymentMethod: "",
      notes: "",
    }),
    []
  );

  const handlePaymentCellValueChanged = useCallback(
    async (event: CellValueChangedEvent<DatagridData<PaymentRow>>) => {
      if (event.column.getColId() === "status") return;
      const row = event.data;
      if (!row || !row.amount) return;

      // In INSERT mode i pagamenti restano solo nella griglia locale,
      // saranno inviati insieme al DDT dal Details al submit
      if (!isUpdate || !values.ddtId) return;

      try {
        await mutatePayment({
          variables: {
            pagamento: {
              pagamentoId: row.paymentId || undefined,
              ddtId: values.ddtId,
              dataPagamento: row.paymentDate,
              importo: Number(row.amount),
              metodoPagamento: row.paymentMethod || undefined,
              note: row.notes || undefined,
            },
          },
        });
        onRefresh();
      } catch {
        showToast({ type: "error", position: "bottom-right", message: "Errore durante il salvataggio del pagamento", autoClose: 2000 });
      }
    },
    [isUpdate, mutatePayment, values.ddtId, onRefresh]
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 900 }}>
      {/* Controlli */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-6">
            <FormikSearchbox<FormikDocumentoTrasportoValues, FornitoreSearchbox>
              label="Fornitore *"
              placeholder="Seleziona fornitore"
              name="nomeFornitore"
              required
              fullWidth
              fieldName="ragioneSociale"
              options={fornitoreSearchboxOption}
              onSelectItem={onSelectFornitore}
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikTextField
              name="ddtNumber"
              label="Numero DDT *"
              fullWidth
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikDateField
              name="ddtDate"
              label="Data DDT *"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ "& input": { colorScheme: dateColorScheme } }}
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikNumberField
              name="amount"
              label="Importo"
              fullWidth
              decimals={2}
            />
          </div>
          <div className="col-span-12 md:col-span-9">
            <FormikSearchbox<FormikDocumentoTrasportoValues, FatturaAcquistoSearchbox>
              label="Fattura"
              placeholder="Cerca fattura"
              name="invoiceNumber"
              fullWidth
              fieldName="numeroFattura"
              options={fatturaAcquistoSearchboxOption}
              onSelectItem={onSelectInvoice}
            />
          </div>
          <div className="col-span-12">
            <FormikTextField
              name="notes"
              label="Note"
              fullWidth
              multiline
              rows={3}
            />
          </div>
        </div>
      </Paper>

      {/* Pagamenti */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Datagrid<PaymentRow>
          gridId="documento-trasporto-payments"
          height="250px"
          items={paymentItems}
          columnDefs={paymentColumnDefs}
          readOnly={false}
          getNewRow={getNewPaymentRow}
          getRowId={({ data }) => (data.paymentId ? data.paymentId.toString() : `new-${Math.random()}`)}
          onCellValueChanged={handlePaymentCellValueChanged}
          onGridReady={handlePaymentGridReady}
        />
      </Paper>
    </Box>
  );
}

export default DocumentoTrasportoForm;
