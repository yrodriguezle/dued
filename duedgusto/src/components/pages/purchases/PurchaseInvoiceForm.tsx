import Grid from "@mui/material/Grid";
import { MenuItem } from "@mui/material";

import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import supplierSearchboxOptions, { type SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";
import FormikTextField from "../../common/form/FormikTextField";
import type { FormikPurchaseInvoiceValues } from "./PurchaseInvoiceDetails";

function PurchaseInvoiceForm() {
  const handleSupplierSelect = () => {
    // Supplier ID è già gestito automaticamente da Formik
  };

  return (
    <Grid container spacing={3}>
      {/* Prima riga: Fornitore e Numero Fattura */}
      <Grid item xs={12} md={6}>
        <FormikSearchbox<FormikPurchaseInvoiceValues, SupplierSearchbox>
          name="supplierId"
          label="Fornitore *"
          options={supplierSearchboxOptions}
          onSelectItem={handleSupplierSelect}
          fullWidth
          autoFocus
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <FormikTextField
          name="invoiceNumber"
          label="Numero Fattura *"
          fullWidth
        />
      </Grid>

      {/* Seconda riga: Data Fattura e Data Scadenza */}
      <Grid item xs={12} md={6}>
        <FormikTextField
          name="invoiceDate"
          label="Data Fattura *"
          type="date"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <FormikTextField
          name="dueDate"
          label="Data Scadenza"
          type="date"
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
      </Grid>

      {/* Terza riga: Imponibile e Aliquota IVA */}
      <Grid item xs={12} md={6}>
        <FormikTextField
          name="taxableAmount"
          label="Imponibile *"
          type="number"
          fullWidth
          inputProps={{ step: "0.01", min: "0" }}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <FormikTextField
          name="vatRate"
          label="Aliquota IVA (%) *"
          type="number"
          fullWidth
          inputProps={{ step: "1", min: "0", max: "100" }}
        />
      </Grid>

      {/* Quarta riga: Stato */}
      <Grid item xs={12} md={6}>
        <FormikTextField
          name="invoiceStatus"
          label="Stato"
          select
          fullWidth
        >
          <MenuItem value="DA_PAGARE">Da Pagare</MenuItem>
          <MenuItem value="PARZIALMENTE_PAGATA">Parzialmente Pagata</MenuItem>
          <MenuItem value="PAGATA">Pagata</MenuItem>
        </FormikTextField>
      </Grid>

      {/* Quinta riga: Note */}
      <Grid item xs={12}>
        <FormikTextField
          name="notes"
          label="Note"
          multiline
          rows={4}
          fullWidth
        />
      </Grid>
    </Grid>
  );
}

export default PurchaseInvoiceForm;
