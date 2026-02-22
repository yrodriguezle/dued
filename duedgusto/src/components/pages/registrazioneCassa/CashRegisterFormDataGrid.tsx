import { Grid, TextField, Box } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues, Income, Expense } from "./RegistroCassaDetails";
import CashCountDataGrid from "./CashCountDataGrid";
import SummaryDataGrid from "./SummaryDataGrid";
import IncomesDataGrid from "./IncomesDataGrid";
import ExpensesDataGrid from "./ExpensesDataGrid";
import { GridReadyEvent } from "ag-grid-community";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";
import { CashCountRowData } from "./useCashCountData";

interface IncomeRow extends Record<string, unknown> {
  type: string;
  amount: number;
}

interface ExpenseRow extends Record<string, unknown> {
  description: string;
  amount: number;
}

interface CashRegisterFormDataGridProps {
  openingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>;
  closingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>;
  incomesGridRef: React.RefObject<GridReadyEvent<DatagridData<IncomeRow>> | null>;
  expensesGridRef: React.RefObject<GridReadyEvent<DatagridData<ExpenseRow>> | null>;
  openingRowData: CashCountRowData[];
  closingRowData: CashCountRowData[];
  initialIncomes: Income[];
  initialExpenses: Expense[];
  onCellChange: () => void;
  onCopyFromPrevious?: () => void;
  refreshKey: number;
}

const CashRegisterFormDataGrid: React.FC<CashRegisterFormDataGridProps> = ({
  openingGridRef,
  closingGridRef,
  incomesGridRef,
  expensesGridRef,
  openingRowData,
  closingRowData,
  initialIncomes,
  initialExpenses,
  onCellChange,
  onCopyFromPrevious,
  refreshKey,
}) => {
  const formik = useFormikContext<FormikCashRegisterValues>();
  const isLocked = formik.status?.isFormLocked || false;

  return (
    <Box sx={{ marginTop: 1, paddingX: { xs: 1, sm: 2, md: 3 } }}>
      <Grid container spacing={{ xs: 2, sm: 2.5, md: 3 }}>
        {/* Apertura Cassa */}
        <Grid item xs={12} lg={6}>
          <CashCountDataGrid
            ref={openingGridRef}
            rowData={openingRowData}
            title="APERTURA CASSA"
            isLocked={isLocked}
            onCellChange={onCellChange}
            onCopyFromPrevious={onCopyFromPrevious}
          />
        </Grid>

        {/* Chiusura Cassa */}
        <Grid item xs={12} lg={6}>
          <CashCountDataGrid
            ref={closingGridRef}
            rowData={closingRowData}
            title="CHIUSURA CASSA"
            isLocked={isLocked}
            onCellChange={onCellChange}
          />
        </Grid>

        {/* Incassi */}
        <Grid item xs={12} md={6}>
          <IncomesDataGrid
            ref={incomesGridRef}
            initialIncomes={initialIncomes}
            isLocked={isLocked}
            onCellChange={onCellChange}
          />
        </Grid>

        {/* Spese */}
        <Grid item xs={12} md={6}>
          <ExpensesDataGrid
            ref={expensesGridRef}
            initialExpenses={initialExpenses}
            isLocked={isLocked}
            onCellChange={onCellChange}
          />
        </Grid>

        {/* Riepilogo */}
        <Grid item xs={12} md={6}>
          <SummaryDataGrid
            openingGridRef={openingGridRef}
            closingGridRef={closingGridRef}
            incomesGridRef={incomesGridRef}
            expensesGridRef={expensesGridRef}
            refreshKey={refreshKey}
          />
        </Grid>

        {/* Note */}
        <Grid item xs={12}>
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
      </Grid>
    </Box>
  );
};

export default CashRegisterFormDataGrid;
