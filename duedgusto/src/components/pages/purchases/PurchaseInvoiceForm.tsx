import { useCallback, useMemo } from "react";
import { Paper, Typography, Grid, Box, Chip, useTheme } from "@mui/material";
import { useFormikContext } from "formik";
import { useMutation } from "@apollo/client";
import { CellValueChangedEvent } from "ag-grid-community";

import FormikTextField from "../../common/form/FormikTextField";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import supplierSearchboxOption, { SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";
import purchaseInvoiceSearchboxOption, { PurchaseInvoiceSearchbox } from "../../common/form/searchbox/searchboxOptions/purchaseInvoiceSearchboxOptions";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { formStatuses } from "../../../common/globals/constants";
import showToast from "../../../common/toast/showToast";
import {
  mutationMutateDeliveryNote,
  mutationMutateSupplierPayment,
} from "../../../graphql/suppliers/mutations";
import { FormikPurchaseInvoiceValues } from "./PurchaseInvoiceDetails";

type DeliveryNoteRow = {
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

interface PurchaseInvoiceFormProps {
  onSelectSupplier: (item: SupplierSearchbox) => void;
  onSelectInvoice: (item: PurchaseInvoiceSearchbox) => void;
  deliveryNotes: DeliveryNote[];
  payments: SupplierPayment[];
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

function PurchaseInvoiceForm({ onSelectSupplier, onSelectInvoice, deliveryNotes, payments, onRefresh }: PurchaseInvoiceFormProps) {
  const { values, status: formStatus } = useFormikContext<FormikPurchaseInvoiceValues>();
  const isUpdate = formStatus?.formStatus === formStatuses.UPDATE;
  const theme = useTheme();
  const dateColorScheme = theme.palette.mode === "dark" ? "dark" : "light";

  const [mutateDeliveryNote] = useMutation(mutationMutateDeliveryNote);
  const [mutatePayment] = useMutation(mutationMutateSupplierPayment);

  const vatAmount = (values.taxableAmount * values.vatRate) / 100;
  const totalAmount = values.taxableAmount + vatAmount;

  // === DDT Grid ===
  const ddtItems = useMemo<DeliveryNoteRow[]>(
    () =>
      deliveryNotes.map((d) => ({
        ddtId: d.ddtId,
        ddtNumber: d.ddtNumber,
        ddtDate: d.ddtDate ? d.ddtDate.split("T")[0] : "",
        amount: d.amount ?? 0,
        notes: d.notes ?? "",
      })),
    [deliveryNotes]
  );

  const ddtColumnDefs = useMemo<DatagridColDef<DeliveryNoteRow>[]>(
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
    (): DeliveryNoteRow => ({
      ddtId: 0,
      ddtNumber: "",
      ddtDate: new Date().toISOString().split("T")[0],
      amount: 0,
      notes: "",
    }),
    []
  );

  const handleDdtCellValueChanged = useCallback(
    async (event: CellValueChangedEvent<DatagridData<DeliveryNoteRow>>) => {
      if (event.column.getColId() === "status") return;
      const row = event.data;
      if (!row || !row.ddtNumber) return;

      try {
        await mutateDeliveryNote({
          variables: {
            deliveryNote: {
              ddtId: row.ddtId || undefined,
              invoiceId: values.invoiceId,
              supplierId: values.supplierId,
              ddtNumber: row.ddtNumber,
              ddtDate: row.ddtDate,
              amount: Number(row.amount) || undefined,
              notes: row.notes || undefined,
            },
          },
        });
        onRefresh();
      } catch {
        showToast({ type: "error", position: "bottom-right", message: "Errore durante il salvataggio del DDT", autoClose: 2000 });
      }
    },
    [mutateDeliveryNote, values.invoiceId, values.supplierId, onRefresh]
  );

  // === Payments Grid ===
  const paymentItems = useMemo<PaymentRow[]>(
    () =>
      payments.map((p) => ({
        paymentId: p.paymentId,
        paymentDate: p.paymentDate ? p.paymentDate.split("T")[0] : "",
        amount: p.amount,
        paymentMethod: p.paymentMethod ?? "",
        notes: p.notes ?? "",
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
            payment: {
              paymentId: row.paymentId || undefined,
              invoiceId: values.invoiceId,
              paymentDate: row.paymentDate,
              amount: Number(row.amount),
              paymentMethod: row.paymentMethod || undefined,
              notes: row.notes || undefined,
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Sezione: Dati Fattura */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Dati Fattura
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <FormikSearchbox<FormikPurchaseInvoiceValues, SupplierSearchbox>
              label="Fornitore *"
              placeholder="Seleziona fornitore"
              name="supplierName"
              required
              fullWidth
              fieldName="businessName"
              options={supplierSearchboxOption}
              onSelectItem={onSelectSupplier}
            />
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: "flex", alignItems: "center" }}>
            {isUpdate && values.invoiceStatus && (
              <Chip
                label={statusLabelMap[values.invoiceStatus] ?? values.invoiceStatus}
                color={statusColorMap[values.invoiceStatus] ?? "default"}
                size="medium"
              />
            )}
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikSearchbox<FormikPurchaseInvoiceValues, PurchaseInvoiceSearchbox>
              label="Numero Fattura *"
              placeholder="Cerca fattura"
              name="invoiceNumber"
              required
              fullWidth
              fieldName="invoiceNumber"
              options={purchaseInvoiceSearchboxOption}
              onSelectItem={onSelectInvoice}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikTextField name="invoiceDate" label="Data Fattura *" type="date" fullWidth slotProps={{ inputLabel: { shrink: true } }} sx={{ "& input": { colorScheme: dateColorScheme } }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikTextField name="dueDate" label="Data Scadenza" type="date" fullWidth slotProps={{ inputLabel: { shrink: true } }} sx={{ "& input": { colorScheme: dateColorScheme } }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikTextField name="taxableAmount" label="Imponibile *" type="number" fullWidth slotProps={{ htmlInput: { step: "0.01", min: "0" } }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikTextField name="vatRate" label="Aliquota IVA %" type="number" fullWidth slotProps={{ htmlInput: { step: "0.01", min: "0", max: "100" } }} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikTextField name="_vatAmount" label="IVA Calcolata" fullWidth disabled value={vatAmount.toFixed(2)} />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikTextField name="_totalAmount" label="Totale con IVA" fullWidth disabled value={totalAmount.toFixed(2)} />
          </Grid>
        </Grid>
      </Paper>

      {/* Sezione: Note */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Note
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormikTextField name="notes" label="Note" fullWidth multiline rows={3} />
          </Grid>
        </Grid>
      </Paper>

      {/* Sezione: DDT - solo in UPDATE */}
      {isUpdate && values.invoiceId && (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Documenti di Trasporto (DDT)
          </Typography>
          <Datagrid<DeliveryNoteRow>
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
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Pagamenti
          </Typography>
          <Datagrid<PaymentRow>
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

export default PurchaseInvoiceForm;
