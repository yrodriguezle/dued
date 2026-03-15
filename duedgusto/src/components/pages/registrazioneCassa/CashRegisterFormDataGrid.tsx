
import { TextField, Box } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./RegistroCassaDetails";
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
  summaryData: SummaryData;
  onOpeningTotalChange: (total: number) => void;
  onClosingTotalChange: (total: number) => void;
  onIncomesChange: (incomes: IncomeEntry[]) => void;
  onExpensesChange: (totalAmount: number, receiptAmount: number) => void;
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
  summaryData,
  onOpeningTotalChange,
  onClosingTotalChange,
  onIncomesChange,
  onExpensesChange,
}) => {
  const formik = useFormikContext<FormikCashRegisterValues>();
  const isLocked = formik.status?.isFormLocked || false;

  return (
    <Box sx={{ marginTop: 1, paddingX: { xs: 0, sm: 1, md: 2 }, overflow: "hidden", width: "100%", boxSizing: "border-box" }}>
      <div className="grid grid-cols-12 gap-2 sm:gap-5 md:gap-6">
        <div className="col-span-12 lg:col-span-6">
          <CashCountDataGrid
            ref={openingGridRef}
            rowData={openingRowData}
            title="APERTURA CASSA"
            isLocked={isLocked}
            onCellChange={onCellChange}
            onCopyFromPrevious={onCopyFromPrevious}
            onTotalChange={onOpeningTotalChange}
          />
        </div>

        <div className="col-span-12 lg:col-span-6">
          <CashCountDataGrid
            ref={closingGridRef}
            rowData={closingRowData}
            title="CHIUSURA CASSA"
            isLocked={isLocked}
            onCellChange={onCellChange}
            onTotalChange={onClosingTotalChange}
          />
        </div>

        <div className="col-span-12 md:col-span-6">
          <IncomesDataGrid
            ref={incomesGridRef}
            initialIncomes={initialIncomes}
            isLocked={isLocked}
            onCellChange={onCellChange}
            onIncomesChange={onIncomesChange}
          />
        </div>

        <div className="col-span-12 md:col-span-6">
          <ExpensesDataGrid
            ref={expensesGridRef}
            initialExpenses={initialExpenses}
            isLocked={isLocked}
            onCellChange={onCellChange}
            onExpensesChange={onExpensesChange}
          />
        </div>

        <div className="col-span-12">
          <SummaryDataGrid summaryData={summaryData} />
        </div>

        <div className="col-span-12">
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
        </div>
      </div>
    </Box>
  );
};

export default CashRegisterFormDataGrid;
