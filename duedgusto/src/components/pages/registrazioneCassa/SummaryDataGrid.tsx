import { useMemo, useState, useEffect } from "react";
import { Box, Typography, useTheme } from "@mui/material";
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
  incomesGridRef: React.RefObject<GridReadyEvent<DatagridData<IncomeRow>> | null>;
  expensesGridRef: React.RefObject<GridReadyEvent<DatagridData<ExpenseRow>> | null>;
}

interface SummaryRowData extends Record<string, unknown> {
  id: number;
  label: string;
  value: number;
  bgColor?: string;
  textColor?: string;
}

function SummaryDataGrid({ openingGridRef, closingGridRef, incomesGridRef, expensesGridRef }: SummaryDataGridProps) {
  const theme = useTheme();
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

  // Leggi i dati dalle griglie incomes/expenses
  const incomes = incomesGridRef.current?.context.getGridData() || [];
  const expenses = expensesGridRef.current?.context.getGridData() || [];

  const cashInWhite = (incomes as IncomeRow[]).find((i) => i.type === "Pago in contanti")?.amount || 0;
  const electronicPayments = (incomes as IncomeRow[]).find((i) => i.type === "Pagamenti Elettronici")?.amount || 0;
  const invoicePayments = (incomes as IncomeRow[]).find((i) => i.type === "Pagamento con Fattura")?.amount || 0;

  // Totale Vendite = (Totale Cassa - Apertura) + Elettronico
  const totalSales = dailyIncome + electronicPayments;

  // ECC = Totale Vendite - Pago in contanti - Elettronico
  const ecc = totalSales - cashInWhite - electronicPayments;

  // Calcola le spese
  const totalExpenses = (expenses as ExpenseRow[]).reduce((sum, expense) => sum + (expense.amount || 0), 0);

  // Calcoli
  const vatAmount = totalSales * 0.1; // 10% IVA (configurabile)

  const rowData = useMemo<SummaryRowData[]>(() => {
    let id = 0;
    return [
      { id: id++, label: "Totale Cassa", value: closingTotal },
      { id: id++, label: "(-) Apertura", value: -openingTotal },
      { id: id++, label: "Totale (-) Apertura", value: dailyIncome },
      {
        id: id++,
        label: "Pago in contanti",
        value: cashInWhite,
        bgColor: theme.palette.success.light,
        textColor: theme.palette.success.contrastText
      },
      {
        id: id++,
        label: "Elettronico",
        value: electronicPayments,
        bgColor: theme.palette.success.light,
        textColor: theme.palette.success.contrastText
      },
      { id: id++, label: "Pagamento con Fattura", value: invoicePayments },
      {
        id: id++,
        label: "Totale Vendite",
        value: totalSales,
        bgColor: theme.palette.warning.light,
        textColor: theme.palette.warning.contrastText
      },
      {
        id: id++,
        label: "Spese Totali",
        value: totalExpenses,
        bgColor: theme.palette.error.light,
        textColor: theme.palette.error.contrastText
      },
      { id: id++, label: "ECC", value: ecc },
      { id: id++, label: "IVA (10%)", value: vatAmount },
    ];
  }, [closingTotal, openingTotal, dailyIncome, cashInWhite, electronicPayments, invoicePayments, totalSales, totalExpenses, ecc, vatAmount, theme.palette.success.light, theme.palette.success.contrastText, theme.palette.warning.light, theme.palette.warning.contrastText, theme.palette.error.light, theme.palette.error.contrastText]);

  const columnDefs = useMemo<DatagridColDef<SummaryRowData>[]>(
    () => [
      {
        headerName: "Descrizione",
        field: "label",
        flex: 2,
        editable: false,
        cellStyle: (params) => {
          const data = params.data as SummaryRowData;
          const style: Record<string, string> = {};
          if (data.bgColor) style.backgroundColor = data.bgColor;
          if (data.textColor) style.color = data.textColor;
          return style;
        },
      },
      {
        headerName: "Importo",
        field: "value",
        flex: 1,
        editable: false,
        cellStyle: (params) => {
          const data = params.data as SummaryRowData;
          const style: Record<string, string> = {
            textAlign: "right",
          };
          if (data.bgColor) style.backgroundColor = data.bgColor;
          if (data.textColor) style.color = data.textColor;
          return style;
        },
        valueFormatter: (params) => {
          const value = params.value;
          const data = params.data as SummaryRowData;
          const prefix = value >= 0 && !data.label.includes("(-)") ? "+" : "";
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
      </Box>
    </Box>
  );
}

export default SummaryDataGrid;
