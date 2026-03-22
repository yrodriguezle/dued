import { Paper, Typography, Box, MenuItem } from "@mui/material";
import FormikNumberField from "../../common/form/FormikNumberField";
import FormikTextField from "../../common/form/FormikTextField";
import PeriodoProgrammazioneSection from "./PeriodoProgrammazioneSection";
import GiorniNonLavorativiSection from "./GiorniNonLavorativiSection";

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

interface BusinessSettingsFormProps {
  periodi: PeriodoProgrammazione[];
  giorniNonLavorativi: GiornoNonLavorativo[];
}

function BusinessSettingsForm({ periodi, giorniNonLavorativi }: BusinessSettingsFormProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {/* Sezione: Attività */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Attività
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-8">
            <FormikTextField
              name="businessName"
              label="Nome Attività"
              fullWidth
            />
          </div>
          <div className="col-span-12 sm:col-span-4">
            <FormikTextField
              name="currency"
              label="Valuta"
              select
              fullWidth
            >
              {CURRENCIES.map((c) => (
                <MenuItem
                  key={c.value}
                  value={c.value}
                >
                  {c.label}
                </MenuItem>
              ))}
            </FormikTextField>
          </div>
        </div>
      </Paper>

      {/* Sezione: Programmazione */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Programmazione
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-6">
            <FormikTextField
              name="timezone"
              label="Fuso Orario"
              select
              fullWidth
            >
              {TIMEZONES.map((tz) => (
                <MenuItem
                  key={tz.value}
                  value={tz.value}
                >
                  {tz.label}
                </MenuItem>
              ))}
            </FormikTextField>
          </div>
        </div>
      </Paper>

      {/* Sezione: Periodi di apertura (include orari) */}
      <PeriodoProgrammazioneSection periodi={periodi} />

      {/* Sezione: Giorni Non Lavorativi */}
      <GiorniNonLavorativiSection giorniNonLavorativi={giorniNonLavorativi} />

      {/* Sezione: Impostazioni Fiscali */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5 }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
          sx={{ mb: 2 }}
        >
          Impostazioni Fiscali
        </Typography>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 sm:col-span-4">
            <FormikNumberField
              name="vatRate"
              label="Aliquota IVA (%)"
              fullWidth
              decimals={2}
            />
          </div>
        </div>
      </Paper>
    </Box>
  );
}

export default BusinessSettingsForm;
