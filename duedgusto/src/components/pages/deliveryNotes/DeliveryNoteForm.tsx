import { Paper, Typography, Grid, Box, useTheme } from "@mui/material";
import FormikTextField from "../../common/form/FormikTextField";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import supplierSearchboxOption, { SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";
import purchaseInvoiceSearchboxOption, { PurchaseInvoiceSearchbox } from "../../common/form/searchbox/searchboxOptions/purchaseInvoiceSearchboxOptions";
import { FormikDeliveryNoteValues } from "./DeliveryNoteDetails";

interface DeliveryNoteFormProps {
  onSelectSupplier: (item: SupplierSearchbox) => void;
  onSelectInvoice: (item: PurchaseInvoiceSearchbox) => void;
}

function DeliveryNoteForm({ onSelectSupplier, onSelectInvoice }: DeliveryNoteFormProps) {
  const theme = useTheme();
  const dateColorScheme = theme.palette.mode === "dark" ? "dark" : "light";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Sezione: Dati DDT */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Dati DDT
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormikSearchbox<FormikDeliveryNoteValues, SupplierSearchbox>
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
          <Grid item xs={12} md={3}>
            <FormikTextField name="ddtNumber" label="Numero DDT *" fullWidth />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikTextField
              name="ddtDate"
              label="Data DDT *"
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ "& input": { colorScheme: dateColorScheme } }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikTextField
              name="amount"
              label="Importo"
              type="number"
              fullWidth
              slotProps={{ htmlInput: { step: "0.01", min: "0" } }}
            />
          </Grid>
          <Grid item xs={12} md={9}>
            <FormikSearchbox<FormikDeliveryNoteValues, PurchaseInvoiceSearchbox>
              label="Fattura"
              placeholder="Cerca fattura"
              name="invoiceNumber"
              fullWidth
              fieldName="invoiceNumber"
              options={purchaseInvoiceSearchboxOption}
              onSelectItem={onSelectInvoice}
            />
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
    </Box>
  );
}

export default DeliveryNoteForm;
