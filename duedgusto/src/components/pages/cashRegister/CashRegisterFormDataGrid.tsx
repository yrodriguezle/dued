import { Grid, TextField, Box } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import CashCountDataGrid from "./CashCountDataGrid";
import SummaryDataGrid from "./SummaryDataGrid";
import IncomesDataGrid from "./IncomesDataGrid";
import ExpensesDataGrid from "./ExpensesDataGrid";

interface CashRegisterFormDataGridProps {
  denominations: CashDenomination[];
  cashRegister?: CashRegister | null;
}

function CashRegisterFormDataGrid({ denominations, cashRegister }: CashRegisterFormDataGridProps) {
  const formik = useFormikContext<FormikCashRegisterValues>();

  return (
    <Box sx={{ marginTop: 1, paddingX: { xs: 1, sm: 2, md: 3 } }}>
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
        {/* Apertura Cassa */}
        <Grid item xs={12} lg={6}>
          <CashCountDataGrid denominations={denominations} fieldName="openingCounts" title="APERTURA CASSA" />
        </Grid>

        {/* Chiusura Cassa */}
        <Grid item xs={12} lg={6}>
          <CashCountDataGrid denominations={denominations} fieldName="closingCounts" title="CHIUSURA CASSA" />
        </Grid>

        {/* Incassi */}
        <Grid item xs={12} md={6}>
          <IncomesDataGrid />
        </Grid>

        {/* Spese */}
        <Grid item xs={12} md={6}>
          <ExpensesDataGrid />
        </Grid>

        {/* Note */}
        <Grid item xs={12} md={6}>
          <Box>
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

        {/* Riepilogo */}
        <Grid item xs={12} md={6}>
          <SummaryDataGrid denominations={denominations} cashRegister={cashRegister} />
        </Grid>
      </Grid>
    </Box>
  );
}

export default CashRegisterFormDataGrid;
