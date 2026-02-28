import { Paper, Typography, Grid } from "@mui/material";
import FormikTextField from "../../common/form/FormikTextField";

interface OperatingHoursSectionProps {
  errors: Record<string, string | undefined>;
  touched: Record<string, boolean>;
}

const timezones = [
  { value: "Europe/Rome", label: "Europe/Rome (CEST/CET)" },
  { value: "Europe/London", label: "Europe/London (BST/GMT)" },
  { value: "Europe/Paris", label: "Europe/Paris (CEST/CET)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CEST/CET)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (CEST/CET)" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CEST/CET)" },
  { value: "Europe/Vienna", label: "Europe/Vienna (CEST/CET)" },
  { value: "Europe/Brussels", label: "Europe/Brussels (CEST/CET)" },
];

const currencies = [
  { value: "EUR", label: "EUR (€)" },
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
];

function OperatingHoursSection({ errors, touched }: OperatingHoursSectionProps) {
  return (
    <Paper sx={{ padding: 1 }}>
      <Typography variant="h6" sx={{ marginBottom: 2, fontWeight: "bold" }}>
        Orari di Apertura
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <FormikTextField
            name="openingTime"
            label="Orario Apertura"
            type="time"
            inputProps={{ step: "300" }}
            error={touched.openingTime && !!errors.openingTime}
            helperText={touched.openingTime && errors.openingTime}
            fullWidth
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormikTextField
            name="closingTime"
            label="Orario Chiusura"
            type="time"
            inputProps={{ step: "300" }}
            error={touched.closingTime && !!errors.closingTime}
            helperText={touched.closingTime && errors.closingTime}
            fullWidth
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormikTextField
            name="timezone"
            label="Fuso Orario"
            select
            SelectProps={{
              native: false,
            }}
            error={touched.timezone && !!errors.timezone}
            helperText={touched.timezone && errors.timezone}
            fullWidth
          >
            {timezones.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </FormikTextField>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormikTextField
            name="currency"
            label="Valuta"
            select
            SelectProps={{
              native: false,
            }}
            error={touched.currency && !!errors.currency}
            helperText={touched.currency && errors.currency}
            fullWidth
          >
            {currencies.map((curr) => (
              <option key={curr.value} value={curr.value}>
                {curr.label}
              </option>
            ))}
          </FormikTextField>
        </Grid>

        <Grid item xs={12}>
          <FormikTextField
            name="vatRate"
            label="Aliquota IVA (%)"
            type="number"
            inputProps={{ step: "0.01", min: "0", max: "100" }}
            error={touched.vatRate && !!errors.vatRate}
            helperText={touched.vatRate && errors.vatRate}
            fullWidth
          />
        </Grid>

        <Grid item xs={12}>
          <FormikTextField name="businessName" label="Nome Attività" error={touched.businessName && !!errors.businessName} helperText={touched.businessName && errors.businessName} fullWidth />
        </Grid>
      </Grid>
    </Paper>
  );
}

export default OperatingHoursSection;
