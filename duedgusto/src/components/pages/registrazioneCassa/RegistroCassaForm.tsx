
import { TextField, Box } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikRegistroCassaValues } from "./RegistroCassaDetails";
import CashCountDataGrid from "./CashCountDataGrid";
import RiepilogoCards from "./RiepilogoCards";
import IncomesDataGrid from "./IncomesDataGrid";
import SpeseDataGrid from "./SpeseDataGrid";
import { GridReadyEvent } from "ag-grid-community";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";
import { CashCountRowData } from "./useCashCountData";
import { statoRegistroCassa } from "../../../common/globals/constants";

// IncomeRow ed ExpenseRow sono i tipi ambient dichiarati in src/@types/RegistroCassa.d.ts

interface RegistroCassaFormProps {
  openingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>;
  closingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>;
  incomesGridRef: React.RefObject<GridReadyEvent<DatagridData<IncomeRow>> | null>;
  expensesGridRef: React.RefObject<GridReadyEvent<DatagridData<ExpenseRow>> | null>;
  openingRowData: CashCountRowData[];
  closingRowData: CashCountRowData[];
  initialIncomes: Income[];
  initialExpenses: Spese[];
  onCellChange: () => void;
  onCopyFromPrevious?: () => void;
  riepilogoGiornaliero: RiepilogoGiornaliero;
  registroCassa?: RegistroCassa | null;
  onOpeningTotalChange: (total: number) => void;
  onClosingTotalChange: (total: number) => void;
  onIncomesChange: (incomes: IncassiGiornalieri[]) => void;
  onExpensesChange: (totalAmount: number, receiptAmount: number) => void;
}

const RegistroCassaForm: React.FC<RegistroCassaFormProps> = ({
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
  riepilogoGiornaliero,
  registroCassa,
  onOpeningTotalChange,
  onClosingTotalChange,
  onIncomesChange,
  onExpensesChange,
}) => {
  const formik = useFormikContext<FormikRegistroCassaValues>();
  const isLocked = formik.status?.isFormLocked || false;
  const isClosed = formik.values.status === statoRegistroCassa.CLOSED;

  return (
    <Box sx={{ marginTop: 1, paddingX: { xs: 0, sm: 1, md: 2 }, overflow: "hidden", width: "100%", boxSizing: "border-box" }}>
      <div className="grid grid-cols-12 gap-2 sm:gap-5 md:gap-6">
        <div className="col-span-12 lg:col-span-6">
          <CashCountDataGrid
            gridId="cash-count-opening"
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
            gridId="cash-count-closing"
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
          <SpeseDataGrid
            ref={expensesGridRef}
            initialExpenses={initialExpenses}
            isLocked={isLocked && !isClosed}
            date={formik.values.date}
            onCellChange={onCellChange}
            onExpensesChange={onExpensesChange}
          />
        </div>

        <div className="col-span-12">
          <RiepilogoCards
            riepilogoGiornaliero={riepilogoGiornaliero}
            registroCassa={registroCassa}
          />
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
              disabled={isLocked}
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

export default RegistroCassaForm;
