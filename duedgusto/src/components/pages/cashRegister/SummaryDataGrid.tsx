import { useMemo } from "react";
import { Box, Typography, Alert } from "@mui/material";
import { useFormikContext } from "formik";
import { FormikCashRegisterValues } from "./CashRegisterDetails";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef } from "../../common/datagrid/@types/Datagrid";

interface SummaryDataGridProps {
  denominations: CashDenomination[];
  cashRegister?: CashRegister | null;
}

interface SummaryRowData extends Record<string, unknown> {
  id: number;
  label: string;
  value: number;
}

function SummaryDataGrid({ denominations, cashRegister }: SummaryDataGridProps) {
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

  // Calcola totale incassi dal form
  const totalIncomes = formik.values.incomes?.reduce((sum, income) => sum + income.amount, 0) || 0;

  // Calcola totale spese dal form
  const totalExpenses = formik.values.expenses?.reduce((sum, expense) => sum + expense.amount, 0) || 0;

  // Calcoli
  const expectedCash = cashSales - totalExpenses;
  const difference = dailyIncome - expectedCash;
  const vatAmount = totalSales * 0.1; // 10% IVA (configurabile)

  const hasDifference = Math.abs(difference) > 5; // Soglia 5€

  const rowData = useMemo<SummaryRowData[]>(() => {
    let id = 0;
    return [
      { id: id++, label: "Totale Cassa", value: closingTotal },
      { id: id++, label: "(-) Apertura", value: -openingTotal },
      { id: id++, label: "Incasso Giornaliero", value: dailyIncome },
      { id: id++, label: "Vendite Contanti", value: cashSales },
      { id: id++, label: "Pagamenti Elettronici", value: electronicPayments },
      { id: id++, label: "Totale Vendite", value: totalSales },
      { id: id++, label: "Totale Incassi", value: totalIncomes },
      { id: id++, label: "Totale Spese", value: -totalExpenses },
      { id: id++, label: "Contante Atteso", value: expectedCash },
      { id: id++, label: "Differenza (ECC)", value: difference },
      { id: id++, label: "IVA (10%)", value: vatAmount },
    ];
  }, [closingTotal, openingTotal, dailyIncome, cashSales, electronicPayments, totalSales, totalIncomes, totalExpenses, expectedCash, difference, vatAmount]);

  const columnDefs = useMemo<DatagridColDef<SummaryRowData>[]>(
    () => [
      {
        headerName: "Descrizione",
        field: "label",
        flex: 2,
        editable: false,
      },
      {
        headerName: "Importo",
        field: "value",
        flex: 1,
        editable: false,
        cellStyle: { textAlign: "right" },
        valueFormatter: (params) => {
          const value = params.value;
          const prefix = value >= 0 ? "+" : "";
          return `${prefix}${value.toFixed(2)}€`;
        },
      },
    ],
    []
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 2 }}>
        RIEPILOGO VENDITE
      </Typography>
      <Box>
        <Datagrid
          height="auto"
          items={rowData}
          columnDefs={columnDefs}
          presentation
          suppressRowHoverHighlight={false}
          domLayout="autoHeight"
        />
        {hasDifference && (
          <Alert severity={difference > 0 ? "warning" : "error"} sx={{ mt: 2 }}>
            Attenzione: la differenza di cassa supera la soglia di 5€
          </Alert>
        )}
      </Box>
    </Box>
  );
}

export default SummaryDataGrid;
