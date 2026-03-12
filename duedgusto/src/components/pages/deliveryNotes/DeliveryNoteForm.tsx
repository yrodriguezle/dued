import { Paper, Typography, Box, useTheme } from "@mui/material";
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
      {/* Sezione: Fornitore e DDT */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Fornitore e DDT
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-6">
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
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikTextField name="ddtNumber" label="Numero DDT *" fullWidth />
          </div>
          <div className="col-span-12 md:col-span-3">
            <FormikTextField name="ddtDate" label="Data DDT *" type="date" fullWidth slotProps={{ inputLabel: { shrink: true } }} sx={{ "& input": { colorScheme: dateColorScheme } }} />
          </div>
        </div>
      </Paper>

      {/* Sezione: Importo e Fattura Collegata */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Importo e Fattura Collegata
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3">
            <FormikTextField name="amount" label="Importo" type="number" fullWidth slotProps={{ htmlInput: { step: "0.01", min: "0" } }} />
          </div>
          <div className="col-span-12 md:col-span-9">
            <FormikSearchbox<FormikDeliveryNoteValues, PurchaseInvoiceSearchbox>
              label="Fattura"
              placeholder="Cerca fattura"
              name="invoiceNumber"
              fullWidth
              fieldName="invoiceNumber"
              options={purchaseInvoiceSearchboxOption}
              onSelectItem={onSelectInvoice}
            />
          </div>
        </div>
      </Paper>

      {/* Sezione: Note */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Note
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <FormikTextField name="notes" label="Note" fullWidth multiline rows={3} />
          </div>
        </div>
      </Paper>
    </Box>
  );
}

export default DeliveryNoteForm;
