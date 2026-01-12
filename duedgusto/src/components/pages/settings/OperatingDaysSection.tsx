import { Paper, Typography, FormControlLabel, Checkbox, Grid, Box } from "@mui/material";
import { useFormikContext } from "formik";

const daysOfWeek = [
  { index: 0, name: "Lunedì" },
  { index: 1, name: "Martedì" },
  { index: 2, name: "Mercoledì" },
  { index: 3, name: "Giovedì" },
  { index: 4, name: "Venerdì" },
  { index: 5, name: "Sabato" },
  { index: 6, name: "Domenica" },
];

interface OperatingDaysSectionProps {
  errors: Record<string, string | undefined>;
  touched: Record<string, boolean>;
}

// Assuming BusinessSettings is defined elsewhere, e.g.,
// interface BusinessSettings {
//   operatingDays: boolean[];
//   // other properties
// }

function OperatingDaysSection({ errors, touched }: OperatingDaysSectionProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { values, setFieldValue, setFieldTouched, status } = useFormikContext<BusinessSettings>() as any;

  const handleDayChange = (index: number, checked: boolean) => {
    setFieldValue(`operatingDays.${index}`, checked);
    setFieldTouched("operatingDays", true);
  };

  return (
    <Paper sx={{ padding: 1 }}>
      <Typography variant="h6" sx={{ marginBottom: 2, fontWeight: "bold" }}>
        Giorni di Apertura
      </Typography>

      <Box sx={{ marginBottom: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 2 }}>
          Seleziona i giorni in cui l'attività è aperta
        </Typography>

        <Grid container spacing={2}>
          {daysOfWeek.map(({ index, name }) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={values.operatingDays[index] || false}
                    onChange={(e) => handleDayChange(index, e.target.checked)}
                    name={`operatingDays.${index}`}
                    disabled={status?.isFormLocked}
                  />
                }
                label={name}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      {errors.operatingDays && touched.operatingDays && (
        <Typography color="error" variant="caption">
          {errors.operatingDays}
        </Typography>
      )}
    </Paper>
  );
}

export default OperatingDaysSection;
