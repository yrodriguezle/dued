import { Box, Paper, Typography, Divider, Alert } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";

interface CashSummaryProps {
  denominations: CashDenomination[];
  cashRegister?: CashRegister | null;
}

function CashSummary({ denominations, cashRegister }: CashSummaryProps) {
  const formik = useFormikContext<FormikCashRegisterValues>();

  const calculateCountTotal = (counts: FormikCashCountValues[]): number => {
    return counts.reduce((sum, count) => {
      const denomination = denominations.find((d) => d.denominationId === count.denominationId);
      return sum + (denomination ? denomination.value * count.quantity : 0);
    }, 0);
  };

  const openingTotal = calculateCountTotal(formik.values.openingCounts || []);
  const closingTotal = calculateCountTotal(formik.values.closingCounts || []);
  const dailyIncome = closingTotal - openingTotal;

  // Valori da backend (se disponibili)
  const cashSales = cashRegister?.cashSales || 0;
  const electronicPayments = cashRegister?.electronicPayments || 0;
  const totalSales = cashRegister?.totalSales || cashSales + electronicPayments;

  const supplierExpenses = parseFloat(String(formik.values.supplierExpenses)) || 0;
  const dailyExpenses = parseFloat(String(formik.values.dailyExpenses)) || 0;

  // Calcoli
  const expectedCash = cashSales - supplierExpenses - dailyExpenses;
  const difference = dailyIncome - expectedCash;
  const vatAmount = totalSales * 0.1; // 10% IVA (configurabile)

  const hasDifference = Math.abs(difference) > 5; // Soglia 5€

  const SummaryRow = ({
    label,
    value,
    bold = false,
    highlight = false,
  }: {
    label: string;
    value: number;
    bold?: boolean;
    highlight?: boolean;
  }) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
      <Typography variant={bold ? "subtitle1" : "body2"} fontWeight={bold ? "bold" : "normal"}>
        {label}
      </Typography>
      <Typography
        variant={bold ? "subtitle1" : "body2"}
        fontWeight={bold ? "bold" : "normal"}
        color={highlight ? (value >= 0 ? "success.main" : "error.main") : "inherit"}
      >
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
          <SummaryRow label="Vendite Contanti" value={cashSales} />
          <SummaryRow label="Pagamenti Elettronici" value={electronicPayments} />
          <Divider sx={{ my: 1 }} />
          <SummaryRow label="Totale Vendite" value={totalSales} bold />
        </Box>

        <Box sx={{ mt: 2 }}>
          <SummaryRow label="Spese Fornitori" value={-supplierExpenses} />
          <SummaryRow label="Spese Giornaliere" value={-dailyExpenses} />
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
