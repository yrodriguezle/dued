import { useMemo } from "react";
import { Box, Chip, Paper, Typography } from "@mui/material";
import formatCurrency from "../../../common/bones/formatCurrency";

interface SummaryDataGridProps {
  summaryData: SummaryData;
  /** Registro cassa dal server: fonte di verità per i totali persistiti (totaleVendite, ...) */
  registroCassa?: RegistroCassa | null;
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
        ...(highlight && { borderColor: "primary.main", borderWidth: 2 }),
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

export function SummaryDataGrid({ summaryData, registroCassa }: SummaryDataGridProps) {
  const { openingTotal, closingTotal, incomes, expensesTotalAmount, receiptExpensesAmount } = summaryData;

  const {
    dailyMovement,
    cashIncome,
    electronicIncome,
    totalSales,
    supplierExpenses,
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

    // Fattura
    const invoice = incomes.find((i) => i.type === "Pagamento con Fattura")?.amount ?? 0;

    // AB: Totale Vendite — usa il valore del server quando disponibile (backend
    // unica fonte di verità); fallback locale allineato alla formula backend
    // (somma dei canali di incasso: contante + elettronico + fattura, NON il
    // movimento fisico di cassa) per registro non ancora salvato.
    const sales = registroCassa?.totaleVendite ?? cash + electronic + invoice;

    // Spese solo fornitori = totale spese - spese scontrino
    const supplierExpenses = expensesTotalAmount - receiptExpensesAmount;

    // AD: Resto fornitore = Contanti - Spese fornitori
    const restoValue = cash - supplierExpenses;

    // AE: ECC = Movimento - Contanti
    const eccValue = movement - cash;

    // AG: Resto finale = ECC - NC ecc (spese scontrino)
    const restoFinaleValue = eccValue - receiptExpensesAmount;

    return {
      dailyMovement: movement,
      cashIncome: cash,
      electronicIncome: electronic,
      totalSales: sales,
      supplierExpenses,
      resto: restoValue,
      ecc: eccValue,
      restoFinale: restoFinaleValue,
    };
  }, [closingTotal, openingTotal, incomes, expensesTotalAmount, receiptExpensesAmount, registroCassa?.totaleVendite]);

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
        label="Spese fornitori"
        value={supplierExpenses}
        negative
      />
      <KPICard
        label="Resto fornitore"
        value={resto}
      />
      <KPICard
        label="ECC"
        value={ecc}
      />
      <KPICard
        label="Spese ecc"
        value={receiptExpensesAmount}
      />
      <KPICard
        label="Resto"
        value={restoFinale}
        highlight
      />
      {registroCassa && (registroCassa.breakdownIva?.length ?? 0) > 0 && (
        <Paper
          variant="outlined"
          sx={{ p: 1, flexBasis: "100%" }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
          >
            IVA (totale € {formatCurrency(registroCassa.importoIva)})
          </Typography>
          {registroCassa.breakdownIva.map((riga) => (
            <Box
              key={`${riga.aliquota}-${riga.stimato}`}
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              <Typography variant="body2">
                {riga.aliquota}% — Imponibile € {formatCurrency(riga.imponibile)} · IVA € {formatCurrency(riga.imposta)}
              </Typography>
              {riga.stimato && (
                <Chip
                  size="small"
                  color="warning"
                  label="stimato"
                />
              )}
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}

export default SummaryDataGrid;
