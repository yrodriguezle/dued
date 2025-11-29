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

function OperatingDaysSection({ errors, touched }: OperatingDaysSectionProps) {
  const { values, setFieldValue } = useFormikContext<BusinessSettings>();

  const handleDayChange = (index: number, checked: boolean) => {
    const newDays = [...values.operatingDays];
    newDays[index] = checked;
    setFieldValue("operatingDays", newDays);
  };

  return (
    <Paper variant="outlined" sx={{ padding: 2, backgroundColor: "action.hover" }}>
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
