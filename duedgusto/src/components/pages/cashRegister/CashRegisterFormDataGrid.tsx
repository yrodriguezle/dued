import { Grid, TextField, Box } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import CashCountDataGrid from "./CashCountDataGrid";
import SummaryDataGrid from "./SummaryDataGrid";
import IncomesDataGrid from "./IncomesDataGrid";
import ExpensesDataGrid from "./ExpensesDataGrid";
import { GridReadyEvent } from "ag-grid-community";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";

interface CashCountRow extends Record<string, unknown> {
  denominationId: number;
  type: "COIN" | "BANKNOTE";
  value: number;
  quantity: number;
  total: number;
}

interface IncomeRow extends Record<string, unknown> {
  type: string;
  amount: number;
}

interface ExpenseRow extends Record<string, unknown> {
  description: string;
  amount: number;
}

interface CashRegisterFormDataGridProps {
  denominations: CashDenomination[];
  cashRegister?: CashRegister | null;
  openingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRow>> | null>;
  closingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRow>> | null>;
  incomesGridRef: React.RefObject<GridReadyEvent<DatagridData<IncomeRow>> | null>;
  expensesGridRef: React.RefObject<GridReadyEvent<DatagridData<ExpenseRow>> | null>;
}

const CashRegisterFormDataGrid: React.FC<CashRegisterFormDataGridProps> = ({
  denominations,
  cashRegister,
  openingGridRef,
  closingGridRef,
  incomesGridRef,
  expensesGridRef
}) => {
  const formik = useFormikContext<FormikCashRegisterValues>();

  return (
    <Box sx={{ marginTop: 1, paddingX: { xs: 1, sm: 2, md: 3 } }}>
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
        {/* Apertura Cassa */}
        <Grid item xs={12} lg={6}>
          <CashCountDataGrid ref={openingGridRef} denominations={denominations} fieldName="openingCounts" title="APERTURA CASSA" />
        </Grid>

        {/* Chiusura Cassa */}
        <Grid item xs={12} lg={6}>
          <CashCountDataGrid ref={closingGridRef} denominations={denominations} fieldName="closingCounts" title="CHIUSURA CASSA" />
        </Grid>

        {/* Incassi */}
        <Grid item xs={12} md={6}>
          <IncomesDataGrid ref={incomesGridRef} />
        </Grid>

        {/* Spese */}
        <Grid item xs={12} md={6}>
          <ExpensesDataGrid ref={expensesGridRef} />
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
};

export default CashRegisterFormDataGrid;
