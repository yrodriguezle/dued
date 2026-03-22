import { useCallback, useMemo } from "react";
import { Paper, Typography, Box, Chip, useTheme } from "@mui/material";
import { useFormikContext } from "formik";
import { useMutation } from "@apollo/client";
import { CellValueChangedEvent } from "ag-grid-community";

import FormikTextField from "../../common/form/FormikTextField";
import FormikDateField from "../../common/form/FormikDateField";
import FormikNumberField from "../../common/form/FormikNumberField";
import NumberField from "../../common/form/NumberField";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import fornitoreSearchboxOption, { FornitoreSearchbox } from "../../common/form/searchbox/searchboxOptions/fornitoreSearchboxOptions";
import fatturaAcquistoSearchboxOption, { FatturaAcquistoSearchbox } from "../../common/form/searchbox/searchboxOptions/fatturaAcquistoSearchboxOptions";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { formStatuses } from "../../../common/globals/constants";
import showToast from "../../../common/toast/showToast";
import { mutationMutateDocumentoTrasporto, mutationMutatePagamentoFornitore } from "../../../graphql/fornitori/mutations";
import { FormikFatturaAcquistoValues } from "./FatturaAcquistoDetails";

type DocumentoTrasportoRow = {
  ddtId: number;
  ddtNumber: string;
  ddtDate: string;
  amount: number;
  notes: string;
};

type PaymentRow = {
  paymentId: number;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  notes: string;
};

interface FatturaAcquistoFormProps {
  onSelectFornitore: (item: FornitoreSearchbox) => void;
  onSelectInvoice: (item: FatturaAcquistoSearchbox) => void;
  documentiTrasporto: DocumentoTrasporto[];
  payments: PagamentoFornitore[];
  onRefresh: () => void;
}

const statusColorMap: Record<string, "error" | "warning" | "success"> = {
  DA_PAGARE: "error",
  PARZIALMENTE_PAGATA: "warning",
  PAGATA: "success",
};

const statusLabelMap: Record<string, string> = {
  DA_PAGARE: "Da pagare",
  PARZIALMENTE_PAGATA: "Parzialmente pagata",
  PAGATA: "Pagata",
};

function FatturaAcquistoForm({ onSelectFornitore, onSelectInvoice, documentiTrasporto, payments, onRefresh }: FatturaAcquistoFormProps) {
  const { values, status: formStatus } = useFormikContext<FormikFatturaAcquistoValues>();
  const isUpdate = formStatus?.formStatus === formStatuses.UPDATE;
  const theme = useTheme();
  const dateColorScheme = theme.palette.mode === "dark" ? "dark" : "light";

  const [mutateDocumentoTrasporto] = useMutation(mutationMutateDocumentoTrasporto);
  const [mutatePayment] = useMutation(mutationMutatePagamentoFornitore);

  const vatAmount = (values.taxableAmount * values.vatRate) / 100;
  const totalAmount = values.taxableAmount + vatAmount;

  // === DDT Grid ===
  const ddtItems = useMemo<DocumentoTrasportoRow[]>(
    () =>
      documentiTrasporto.map((d) => ({
        ddtId: d.ddtId,
        ddtNumber: d.numeroDdt,
        ddtDate: d.dataDdt ? d.dataDdt.split("T")[0] : "",
        amount: d.importo ?? 0,
        notes: d.note ?? "",
      })),
    [documentiTrasporto]
  );

  const ddtColumnDefs = useMemo<DatagridColDef<DocumentoTrasportoRow>[]>(
    () => [
      { headerName: "Numero DDT", field: "ddtNumber", editable: true, flex: 1 },
      { headerName: "Data DDT", field: "ddtDate", editable: true, flex: 1, cellEditor: "agDateStringCellEditor" },
      {
        headerName: "Importo",
        field: "amount",
        editable: true,
        width: 130,
        cellEditor: "agNumberCellEditor",
        cellEditorParams: { precision: 2 },
        valueFormatter: (params) => (params.value != null ? Number(params.value).toFixed(2) : ""),
      },
      { headerName: "Note", field: "notes", editable: true, flex: 1 },
    ],
    []
  );

  const getNewDdtRow = useCallback(
    (): DocumentoTrasportoRow => ({
      ddtId: 0,
      ddtNumber: "",
      ddtDate: new Date().toISOString().split("T")[0],
      amount: 0,
      notes: "",
    }),
    []
  );

  const handleDdtCellValueChanged = useCallback(
    async (event: CellValueChangedEvent<DatagridData<DocumentoTrasportoRow>>) => {
      if (event.column.getColId() === "status") return;
      const row = event.data;
      if (!row || !row.ddtNumber) return;

      try {
        await mutateDocumentoTrasporto({
          variables: {
            documentoTrasporto: {
              ddtId: row.ddtId || undefined,
              fatturaId: values.invoiceId,
              fornitoreId: values.fornitoreId,
              numeroDdt: row.ddtNumber,
              dataDdt: row.ddtDate,
              importo: Number(row.amount) || undefined,
              note: row.notes || undefined,
            },
          },
        });
        onRefresh();
      } catch {
        showToast({ type: "error", position: "bottom-right", message: "Errore durante il salvataggio del DDT", autoClose: 2000 });
      }
    },
    [mutateDocumentoTrasporto, values.invoiceId, values.fornitoreId, onRefresh]
  );

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

      try {
        await mutatePayment({
          variables: {
            pagamento: {
              pagamentoId: row.paymentId || undefined,
              fatturaId: values.invoiceId,
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
    [mutatePayment, values.invoiceId, onRefresh]
  );

  return (
    <Box
      sx={{ 
        display: "flex", 
        flexDirection: "column", 
        maxWidth: 900,
        gap: 2.5,
      }}
    >
      {/* Sezione: Fornitore */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Fornitore
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-8">
            <FormikSearchbox<FormikFatturaAcquistoValues, FornitoreSearchbox>
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
          <div className="col-span-12 md:col-span-4 flex items-center">
            {isUpdate && values.invoiceStatus && <Chip
              label={statusLabelMap[values.invoiceStatus] ?? values.invoiceStatus}
              color={statusColorMap[values.invoiceStatus] ?? "default"}
              size="medium"
            />}
          </div>
        </div>
      </Paper>

      {/* Sezione: Dati Fattura */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Dati Fattura
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-4">
            <FormikSearchbox<FormikFatturaAcquistoValues, FatturaAcquistoSearchbox>
              label="Numero Fattura *"
              placeholder="Cerca fattura"
              name="invoiceNumber"
              required
              fullWidth
              fieldName="numeroFattura"
              options={fatturaAcquistoSearchboxOption}
              onSelectItem={onSelectInvoice}
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikDateField
              name="invoiceDate"
              label="Data Fattura *"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ "& input": { colorScheme: dateColorScheme } }}
            />
          </div>
          <div className="col-span-12 md:col-span-4">
            <FormikDateField
              name="dueDate"
              label="Data Scadenza"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ "& input": { colorScheme: dateColorScheme } }}
            />
          </div>
        </div>
      </Paper>

      {/* Sezione: Importi */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Importi
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3">
            <FormikNumberField
              name="taxableAmount"
              label="Imponibile *"
              fullWidth
              slotProps={{ htmlInput: { step: "0.01", min: "0" } }}
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikNumberField
              name="vatRate"
              label="Aliquota IVA %"
              fullWidth
              slotProps={{ htmlInput: { step: "0.01", min: "0", max: "100" } }}
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <NumberField
              name="_vatAmount"
              label="IVA Calcolata"
              fullWidth
              disabled
              value={vatAmount}
              decimals={2}
            />
          </div>
          <div className="col-span-12 md:col-span-3">
            <NumberField
              name="_totalAmount"
              label="Totale con IVA"
              fullWidth
              disabled
              value={totalAmount}
              decimals={2}
            />
          </div>
        </div>
      </Paper>

      {/* Sezione: Note */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Note
        </Typography>
        <div className="grid grid-cols-12 gap-4">
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

      {/* Sezione: DDT - solo in UPDATE */}
      {isUpdate && values.invoiceId && (
        <Paper
          variant="outlined"
          sx={{ p: 2.5 }}
        >
          <Typography
            variant="subtitle1"
            fontWeight={600}
            sx={{ mb: 2 }}
          >
            Documenti di Trasporto (DDT)
          </Typography>
          <Datagrid<DocumentoTrasportoRow>
            gridId="fattura-acquisto-ddt"
            height="250px"
            items={ddtItems}
            columnDefs={ddtColumnDefs}
            readOnly={false}
            getNewRow={getNewDdtRow}
            getRowId={({ data }) => (data.ddtId ? data.ddtId.toString() : `new-${Math.random()}`)}
            onCellValueChanged={handleDdtCellValueChanged}
          />
        </Paper>
      )}

      {/* Sezione: Pagamenti - solo in UPDATE */}
      {isUpdate && values.invoiceId && (
        <Paper
          variant="outlined"
          sx={{ p: 2.5 }}
        >
          <Typography
            variant="subtitle1"
            fontWeight={600}
            sx={{ mb: 2 }}
          >
            Pagamenti
          </Typography>
          <Datagrid<PaymentRow>
            gridId="fattura-acquisto-payments"
            height="250px"
            items={paymentItems}
            columnDefs={paymentColumnDefs}
            readOnly={false}
            getNewRow={getNewPaymentRow}
            getRowId={({ data }) => (data.paymentId ? data.paymentId.toString() : `new-${Math.random()}`)}
            onCellValueChanged={handlePaymentCellValueChanged}
          />
        </Paper>
      )}
    </Box>
  );
}

export default FatturaAcquistoForm;
