import { Paper, Typography, Grid, Box, FormControlLabel, Checkbox, MenuItem } from "@mui/material";
import { useFormikContext } from "formik";
import FormikTextField from "../../common/form/FormikTextField";

const TIMEZONES = [
  { value: "Europe/Rome", label: "Roma (CEST/CET)" },
  { value: "Europe/London", label: "Londra (BST/GMT)" },
  { value: "Europe/Paris", label: "Parigi (CEST/CET)" },
  { value: "Europe/Berlin", label: "Berlino (CEST/CET)" },
  { value: "Europe/Madrid", label: "Madrid (CEST/CET)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CEST/CET)" },
  { value: "Europe/Vienna", label: "Vienna (CEST/CET)" },
  { value: "Europe/Brussels", label: "Bruxelles (CEST/CET)" },
];

const CURRENCIES = [
  { value: "EUR", label: "EUR (\u20AC)" },
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (\u00A3)" },
];

const DAYS_OF_WEEK = [
  { index: 0, name: "Lunedì" },
  { index: 1, name: "Martedì" },
  { index: 2, name: "Mercoledì" },
  { index: 3, name: "Giovedì" },
  { index: 4, name: "Venerdì" },
  { index: 5, name: "Sabato" },
  { index: 6, name: "Domenica" },
];

function BusinessSettingsForm() {
  const { values, errors, touched, setFieldValue, setFieldTouched, status } = useFormikContext<BusinessSettings>();
  const isLocked = status?.isFormLocked;

  const handleDayChange = (index: number, checked: boolean) => {
    setFieldValue(`operatingDays.${index}`, checked);
    setFieldTouched("operatingDays", true);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Sezione: Attività */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Attività
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <FormikTextField name="businessName" label="Nome Attività" fullWidth />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormikTextField name="currency" label="Valuta" select fullWidth>
              {CURRENCIES.map((c) => (
                <MenuItem key={c.value} value={c.value}>
                  {c.label}
                </MenuItem>
              ))}
            </FormikTextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Sezione: Programmazione */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Programmazione
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <FormikTextField name="openingTime" label="Apertura" type="time" inputProps={{ step: "300" }} fullWidth />
          </Grid>
          <Grid item xs={6} sm={3}>
            <FormikTextField name="closingTime" label="Chiusura" type="time" inputProps={{ step: "300" }} fullWidth />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormikTextField name="timezone" label="Fuso Orario" select fullWidth>
              {TIMEZONES.map((tz) => (
                <MenuItem key={tz.value} value={tz.value}>
                  {tz.label}
                </MenuItem>
              ))}
            </FormikTextField>
          </Grid>

          {/* Giorni operativi */}
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Giorni di apertura
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {DAYS_OF_WEEK.map(({ index, name }) => (
                <FormControlLabel
                  key={index}
                  control={
                    <Checkbox
                      checked={values.operatingDays[index] || false}
                      onChange={(e) => handleDayChange(index, e.target.checked)}
                      name={`operatingDays.${index}`}
                      disabled={isLocked}
                      size="small"
                    />
                  }
                  label={name}
                  sx={{ mr: 2 }}
                />
              ))}
            </Box>
            {errors.operatingDays && touched.operatingDays && (
              <Typography color="error" variant="caption">
                {typeof errors.operatingDays === "string" ? errors.operatingDays : ""}
              </Typography>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Sezione: Impostazioni Fiscali */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Impostazioni Fiscali
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <FormikTextField
              name="vatRate"
              label="Aliquota IVA (%)"
              type="number"
              inputProps={{ step: "0.01", min: "0", max: "100" }}
              onChange={(_name, value, field, form) => {
                form.setFieldValue(field.name, value === "" ? 0 : Number(value));
              }}
              fullWidth
            />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

export default BusinessSettingsForm;
