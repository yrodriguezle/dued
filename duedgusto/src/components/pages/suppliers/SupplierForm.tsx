import { Grid } from "@mui/material";
import FormikTextField from "../../common/form/FormikTextField";
import FormikCheckbox from "../../common/form/FormikCheckbox";

function SupplierForm() {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={8}>
        <FormikTextField
          name="businessName"
          label="Ragione Sociale *"
          fullWidth
          autoFocus
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

      <Grid item xs={12} md={6}>
        <FormikTextField name="email" label="Email" type="email" fullWidth />
      </Grid>

      <Grid item xs={12} md={6}>
        <FormikTextField name="phone" label="Telefono" fullWidth />
      </Grid>

      <Grid item xs={12} md={9}>
        <FormikTextField name="address" label="Indirizzo" fullWidth />
      </Grid>

      <Grid item xs={12} md={3}>
        <FormikTextField name="postalCode" label="CAP" fullWidth />
      </Grid>

      <Grid item xs={12} md={6}>
        <FormikTextField name="city" label="Città" fullWidth />
      </Grid>

      <Grid item xs={12} md={6}>
        <FormikTextField name="country" label="Paese" fullWidth />
      </Grid>

      <Grid item xs={12}>
        <FormikTextField
          name="notes"
          label="Note"
          fullWidth
          multiline
          rows={4}
        />
      </Grid>
    </Grid>
  );
}

export default SupplierForm;
