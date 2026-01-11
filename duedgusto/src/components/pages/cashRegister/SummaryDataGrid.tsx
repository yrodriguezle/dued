import { useMemo, useState, useEffect } from "react";
import { Box, Typography, Alert } from "@mui/material";
import Datagrid from "../../common/datagrid/Datagrid";
import { DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";
import { GridReadyEvent } from "ag-grid-community";
import { CashCountRowData } from "./useCashCountData";

interface IncomeRow extends Record<string, unknown> {
  type: string;
  amount: number;
}

interface ExpenseRow extends Record<string, unknown> {
  description: string;
  amount: number;
}

interface SummaryDataGridProps {
  openingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>;
  closingGridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>;
}

interface SummaryRowData extends Record<string, unknown> {
  id: number;
  label: string;
  value: number;
}

function SummaryDataGrid({ openingGridRef, closingGridRef }: SummaryDataGridProps) {
  const [openingTotal, setOpeningTotal] = useState(0);
  const [closingTotal, setClosingTotal] = useState(0);

  // Ricalcola i totali quando le griglie cambiano
  useEffect(() => {
    const calculateTotal = (gridRef: React.RefObject<GridReadyEvent<DatagridData<CashCountRowData>> | null>): number => {
      if (!gridRef.current) return 0;

      let total = 0;
      gridRef.current.api.forEachNode((node) => {
        if (node.data && !node.rowPinned) {
          total += node.data.total;
        }
      });
      return total;
    };

    const interval = setInterval(() => {
      setOpeningTotal(calculateTotal(openingGridRef));
      setClosingTotal(calculateTotal(closingGridRef));
    }, 100);

    return () => clearInterval(interval);
  }, [openingGridRef, closingGridRef]);

  const dailyIncome = closingTotal - openingTotal;

  // TODO: Questi valori dovrebbero venire dalle griglie incomes/expenses
  const cashSales = 0;
  const electronicPayments = 0;
  const totalSales = cashSales + electronicPayments;
  const totalIncomes = 0;
  const totalExpenses = 0;

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
