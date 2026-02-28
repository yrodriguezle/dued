import { Paper, Typography, Grid, Box } from "@mui/material";
import FormikTextField from "../../common/form/FormikTextField";
import FormikCheckbox from "../../common/form/FormikCheckbox";
import FormikSearchbox from "../../common/form/searchbox/FormikSearchbox";
import supplierSearchboxOption, { SupplierSearchbox } from "../../common/form/searchbox/searchboxOptions/supplierSearchboxOptions";
import { FormikSupplierValues } from "./SupplierDetails";

interface SupplierFormProps {
  onSelectItem: (item: SupplierSearchbox) => void;
}

function SupplierForm({ onSelectItem }: SupplierFormProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Sezione: Dati Generali */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Dati Generali
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <FormikSearchbox<FormikSupplierValues, SupplierSearchbox>
              label="Ragione Sociale *"
              placeholder="Ragione Sociale"
              name="businessName"
              autoFocus
              required
              fullWidth
              fieldName="businessName"
              options={supplierSearchboxOption}
              onSelectItem={onSelectItem}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormikCheckbox name="active" label="Attivo" />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormikTextField name="vatNumber" label="Partita IVA" fullWidth />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormikTextField name="fiscalCode" label="Codice Fiscale" fullWidth />
          </Grid>
        </Grid>
      </Paper>

      {/* Sezione: Contatti */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Contatti
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <FormikTextField name="email" label="Email" type="email" fullWidth />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormikTextField name="phone" label="Telefono" fullWidth />
          </Grid>
        </Grid>
      </Paper>

      {/* Sezione: Indirizzo */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Indirizzo
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={9}>
            <FormikTextField name="address" label="Indirizzo" fullWidth />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormikTextField name="postalCode" label="CAP" fullWidth />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormikTextField name="city" label="Citta" fullWidth />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormikTextField name="province" label="Provincia" fullWidth />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormikTextField name="country" label="Paese" fullWidth />
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
            <FormikTextField name="notes" label="Note" fullWidth multiline rows={4} />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default SupplierForm;
