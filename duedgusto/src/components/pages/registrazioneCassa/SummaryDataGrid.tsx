import { useMemo } from "react";
import { Box, Paper, Typography } from "@mui/material";
import formatCurrency from "../../../common/bones/formatCurrency";

interface SummaryDataGridProps {
  summaryData: SummaryData;
}

interface KPICardProps {
  label: string;
  value: number;
  highlight?: boolean;
  negative?: boolean;
}

function KPICard({ label, value, highlight, negative }: KPICardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        textAlign: "center",
        flex: "1 1 auto",
        minWidth: "100px",
        ...(highlight && { borderColor: "#ffab40", borderWidth: 2 }),
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        noWrap
      >
        {label}
      </Typography>
      <Typography
        variant="h6"
        fontWeight="bold"
        color={negative ? "error.main" : "text.primary"}
        noWrap
      >
        {formatCurrency(value)}
      </Typography>
    </Paper>
  );
}

export function SummaryDataGrid({ summaryData }: SummaryDataGridProps) {
  const { openingTotal, closingTotal, incomes, expensesTotalAmount, receiptExpensesAmount } = summaryData;

  const {
    dailyMovement,
    cashIncome,
    electronicIncome,
    totalSales,
    resto,
    ecc,
    restoFinale,
  } = useMemo(() => {
    // Y: Totale (-) Apertura = Chiusura - Apertura
    const movement = closingTotal - openingTotal;

    // Z: Pagato Contanti
    const cash = incomes.find((i) => i.type === "Pago in contanti")?.amount ?? 0;

    // AA: Elettronico
    const electronic = incomes.find((i) => i.type === "Pagamenti Elettronici")?.amount ?? 0;

    // AB: Totale Vendite = Movimento + Elettronico
    const sales = movement + electronic;

    // AD: Resto = Contanti - Spese totali
    const restoValue = cash - expensesTotalAmount;

    // AE: ECC = Movimento - Contanti
    const eccValue = movement - cash;

    // AG: Resto finale = ECC - NC ecc (spese scontrino)
    const restoFinaleValue = eccValue - receiptExpensesAmount;

    return {
      dailyMovement: movement,
      cashIncome: cash,
      electronicIncome: electronic,
      totalSales: sales,
      resto: restoValue,
      ecc: eccValue,
      restoFinale: restoFinaleValue,
    };
  }, [closingTotal, openingTotal, incomes, expensesTotalAmount, receiptExpensesAmount]);

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      <KPICard
        label="Totale (-) Apertura"
        value={dailyMovement}
      />
      <KPICard
        label="Pagato Contanti"
        value={cashIncome}
      />
      <KPICard
        label="Elett"
        value={electronicIncome}
      />
      <KPICard
        label="Totale Vendite"
        value={totalSales}
        highlight
      />
      <KPICard
        label="Fornitori / Spese gg"
        value={expensesTotalAmount}
        negative
      />
      <KPICard
        label="Resto"
        value={resto}
      />
      <KPICard
        label="ECC"
        value={ecc}
      />
      <KPICard
        label="NC ecc"
        value={receiptExpensesAmount}
      />
      <KPICard
        label="Resto"
        value={restoFinale}
        highlight
      />
    </Box>
  );
}

export default SummaryDataGrid;
