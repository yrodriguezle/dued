import { Box, Paper, Typography, Divider, Alert } from "@mui/material";
import { GridReadyEvent } from "ag-grid-community";
import { DatagridData } from "../../common/datagrid/@types/Datagrid";

interface CashSummaryProps {
  openingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRow>> | null>;
  closingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRow>> | null>;
  incomesGridRef: React.RefObject<GridReadyEvent<DatagridData<IncomeRow>> | null>;
  expensesGridRef: React.RefObject<GridReadyEvent<DatagridData<ExpenseRow>> | null>;
}

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

function CashSummary({ openingGridRef, closingGridRef, incomesGridRef, expensesGridRef }: CashSummaryProps) {
  const calculateCountTotal = (counts: CashCountRow[]): number => {
    return counts.reduce((sum, count) => {
      return sum + (count.total || 0);
    }, 0);
  };

  // Leggi i dati dalle griglie
  const openingCounts = openingGridRef.current?.context.getGridData() || [];
  const closingCounts = closingGridRef.current?.context.getGridData() || [];
  const incomes = incomesGridRef.current?.context.getGridData() || [];
  const expenses = expensesGridRef.current?.context.getGridData() || [];

  const openingTotal = calculateCountTotal(openingCounts as CashCountRow[]);
  const closingTotal = calculateCountTotal(closingCounts as CashCountRow[]);
  const dailyIncome = closingTotal - openingTotal;

  // Calcola i valori dalle entrate
  const cashInWhite = (incomes as IncomeRow[]).find((i) => i.type === "Pago in contanti")?.amount || 0;
  const electronicPayments = (incomes as IncomeRow[]).find((i) => i.type === "Pagamenti Elettronici")?.amount || 0;
  const invoicePayments = (incomes as IncomeRow[]).find((i) => i.type === "Pagamento con Fattura")?.amount || 0;
  const totalSales = cashInWhite + electronicPayments + invoicePayments;

  // Calcola le spese
  const totalExpenses = (expenses as ExpenseRow[]).reduce((sum, expense) => sum + (expense.amount || 0), 0);

  // Calcoli
  const expectedCash = cashInWhite - totalExpenses;
  const difference = dailyIncome - expectedCash;
  const vatAmount = totalSales * 0.1; // 10% IVA (configurabile)

  const hasDifference = Math.abs(difference) > 5; // Soglia 5€

  const SummaryRow = ({ label, value, bold = false, highlight = false }: { label: string; value: number; bold?: boolean; highlight?: boolean }) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
      <Typography variant={bold ? "subtitle1" : "body2"} fontWeight={bold ? "bold" : "normal"}>
        {label}
      </Typography>
      <Typography variant={bold ? "subtitle1" : "body2"} fontWeight={bold ? "bold" : "normal"} color={highlight ? (value >= 0 ? "success.main" : "error.main") : "inherit"}>
        {value >= 0 ? "+" : ""}
        {value.toFixed(2)}€
      </Typography>
    </Box>
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 2 }}>
        Riepilogo Vendite
      </Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <SummaryRow label="Totale Cassa" value={closingTotal} bold />
        <SummaryRow label="(-) Apertura" value={-openingTotal} />
        <Divider sx={{ my: 1 }} />
        <SummaryRow label="Incasso Giornaliero" value={dailyIncome} bold />

        <Box sx={{ mt: 2 }}>
          <SummaryRow label="Pago in contanti" value={cashInWhite} />
          <SummaryRow label="Pagamenti Elettronici" value={electronicPayments} />
          <SummaryRow label="Pagamento con Fattura" value={invoicePayments} />
          <Divider sx={{ my: 1 }} />
          <SummaryRow label="Totale Vendite" value={totalSales} bold />
        </Box>

        <Box sx={{ mt: 2 }}>
          <SummaryRow label="Spese Totali" value={-totalExpenses} />
          <Divider sx={{ my: 1 }} />
          <SummaryRow label="Contante Atteso" value={expectedCash} />
        </Box>

        <Divider sx={{ my: 2 }} />
        <SummaryRow label="Differenza (ECC)" value={difference} bold highlight />
        <SummaryRow label="IVA (10%)" value={vatAmount} />

        {hasDifference && (
          <Alert severity={difference > 0 ? "warning" : "error"} sx={{ mt: 2 }}>
            Attenzione: la differenza di cassa supera la soglia di 5€
          </Alert>
        )}
      </Paper>
    </Box>
  );
}

export default CashSummary;
