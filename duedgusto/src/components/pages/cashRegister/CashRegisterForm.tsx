import { Grid, TextField, Box } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import CashCountTable from "./CashCountTable";
import CashSummary from "./CashSummary";

interface CashRegisterFormProps {
  denominations: CashDenomination[];
  cashRegister?: CashRegister | null;
}

function CashRegisterForm({ denominations, cashRegister }: CashRegisterFormProps) {
  const formik = useFormikContext<FormikCashRegisterValues>();

  return (
    <Box sx={{ marginTop: 1, paddingX: { xs: 1, sm: 2, md: 3 } }}>
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
        {/* Apertura Cassa */}
        <Grid item xs={12} md={6}>
          <CashCountTable denominations={denominations} fieldName="openingCounts" title="APERTURA CASSA" />
        </Grid>

        {/* Chiusura Cassa */}
        <Grid item xs={12} md={6}>
          <CashCountTable denominations={denominations} fieldName="closingCounts" title="CHIUSURA CASSA" />
        </Grid>

        {/* Riepilogo */}
        <Grid item xs={12} md={6}>
          <CashSummary denominations={denominations} cashRegister={cashRegister} />
        </Grid>

        {/* Spese e Note */}
        <Grid item xs={12} md={6}>
          <Box>
            <TextField
              label="Spese Fornitori"
              name="supplierExpenses"
              type="number"
              value={formik.values.supplierExpenses}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.supplierExpenses && Boolean(formik.errors.supplierExpenses)}
              helperText={formik.touched.supplierExpenses && formik.errors.supplierExpenses}
              fullWidth
              margin="normal"
              inputProps={{ min: 0, step: "0.01" }}
            />
            <TextField
              label="Altre Spese Giornaliere"
              name="dailyExpenses"
              type="number"
              value={formik.values.dailyExpenses}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.dailyExpenses && Boolean(formik.errors.dailyExpenses)}
              helperText={formik.touched.dailyExpenses && formik.errors.dailyExpenses}
              fullWidth
              margin="normal"
              inputProps={{ min: 0, step: "0.01" }}
            />
            <TextField
              label="Note"
              name="notes"
              multiline
              rows={4}
              value={formik.values.notes}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              fullWidth
              margin="normal"
              placeholder="Inserisci eventuali note sulla chiusura cassa..."
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default CashRegisterForm;
