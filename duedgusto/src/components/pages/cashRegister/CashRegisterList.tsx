import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Typography, useTheme } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent, ValueFormatterParams } from "ag-grid-community";
import { getFormattedDate } from "../../../common/date/date";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useFetchData from "../../../graphql/common/useFetchData";
import { getCashRegisters } from "../../../graphql/cashRegister/queries";
import { DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";

function CashRegisterList() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { title, setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<CashRegister>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<CashRegister>[]>([]);
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Chiusure cassa");
  }, [setTitle]);

  const variables = useMemo(
    () => ({
      pageSize: 50,
      where: "",
      orderBy: "date desc",
    }),
    []
  );

  const { items: cashRegisters, loading } = useFetchData<CashRegister>({
    query: getCashRegisters,
    variables,
    fetchPolicy: "network-only",
  });

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<CashRegister>>) => {
    gridRef.current = event;

    event.api.addEventListener("selectionChanged", () => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    });
  }, []);

  const handleNew = useCallback(() => {
    // Navigate to today's date
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    navigate(`/gestionale/cassa/${today}`);
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (selectedRows.length === 0) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Seleziona almeno una chiusura cassa da eliminare",
        autoClose: 2000,
        toastId: "warning-no-selection",
      });
      return;
    }

    const confirmed = await onConfirm({
      title: "Conferma eliminazione",
      content: `Sei sicuro di voler eliminare ${selectedRows.length} chiusura/e cassa selezionata/e?`,
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
    });

    if (!confirmed) {
      return;
    }

    try {
      // TODO: Implementare la mutation per l'eliminazione
      showToast({
        type: "info",
        position: "bottom-right",
        message: "Funzionalità di eliminazione non ancora implementata",
        autoClose: 2000,
        toastId: "info-delete",
      });
    } catch {
      showToast({
        type: "error",
        position: "bottom-right",
        message: "Errore durante l'eliminazione",
        autoClose: 3000,
        toastId: "error-delete",
      });
    }
  }, [selectedRows, onConfirm]);

  const handleRowDoubleClicked = useCallback(
    (event: DatagridRowDoubleClickedEvent<CashRegister>) => {
      const data = event.data as CashRegister | undefined;
      if (data?.date) {
        // Extract date in YYYY-MM-DD format
        const dateStr = data.date.split("T")[0];
        navigate(`/gestionale/cassa/${dateStr}`);
      }
    },
    [navigate]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columnDefs = useMemo<any[]>(
    () => [
      {
        field: "date",
        headerName: "Data",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return getFormattedDate(params.value as string, "DD/MM/YYYY");
        },
      },
      {
        field: "user.userName",
        headerName: "Operatore",
        width: 150,
      },
      {
        field: "openingTotal",
        headerName: "Apertura",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "closingTotal",
        headerName: "Totale Cassa",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "dailyIncome",
        headerName: "Totale (-) Apertura",
        width: 150,
        valueGetter: (params: { data: CashRegister }) => {
          const cr = params.data;
          if (!cr) return 0;
          return (cr.closingTotal || 0) - (cr.openingTotal || 0);
        },
        valueFormatter: (params: ValueFormatterParams) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "cashInWhite",
        headerName: "Pago in contanti",
        width: 140,
        cellStyle: { backgroundColor: theme.palette.success.light, color: theme.palette.success.contrastText },
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "electronicPayments",
        headerName: "Elettronico",
        width: 120,
        cellStyle: { backgroundColor: theme.palette.success.light, color: theme.palette.success.contrastText },
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "totalSales",
        headerName: "Totale Vendite",
        width: 140,
        cellStyle: { backgroundColor: theme.palette.warning.light, color: theme.palette.warning.contrastText },
        valueGetter: (params: { data: CashRegister }) => {
          const cr = params.data;
          if (!cr) return 0;
          // Totale Vendite = (Totale Cassa - Apertura) + Elettronico
          return (cr.closingTotal || 0) - (cr.openingTotal || 0) + (cr.electronicPayments || 0);
        },
        valueFormatter: (params: ValueFormatterParams) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "invoicePayments",
        headerName: "Pagamenti Fattura",
        width: 150,
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "totalExpenses",
        headerName: "Spese Totali",
        width: 130,
        cellStyle: { backgroundColor: theme.palette.error.light, color: theme.palette.error.contrastText },
        valueGetter: (params: { data: CashRegister }) => {
          const cr = params.data;
          if (!cr) return 0;
          return (cr.supplierExpenses || 0) + (cr.dailyExpenses || 0);
        },
        valueFormatter: (params: ValueFormatterParams) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "ecc",
        headerName: "ECC",
        width: 120,
        valueGetter: (params: { data: CashRegister }) => {
          const cr = params.data;
          if (!cr) return 0;
          // ECC = Totale Vendite - Pago in contanti - Elettronico
          const totalSales = (cr.closingTotal || 0) - (cr.openingTotal || 0) + (cr.electronicPayments || 0);
          return totalSales - (cr.cashInWhite || 0) - (cr.electronicPayments || 0);
        },
        valueFormatter: (params: ValueFormatterParams) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "status",
        headerName: "Stato",
        width: 120,
        valueGetter: (params: { data: CashRegister }) => {
          const cr = params.data;
          if (!cr || !cr.status) return "DRAFT";
          // Se status è un numero, converti a stringa corrispondente
          if (typeof cr.status === "number") {
            const statusMap: Record<number, string> = {
              0: "DRAFT",
              1: "CLOSED",
              2: "RECONCILED",
            };
            return statusMap[cr.status] || "DRAFT";
          }
          return cr.status;
        },
        cellRenderer: (params: { value: string }) => {
          const statusColors: Record<string, "default" | "success" | "primary"> = {
            DRAFT: "default",
            CLOSED: "success",
            RECONCILED: "primary",
          };
          const statusLabels: Record<string, string> = {
            DRAFT: "Bozza",
            CLOSED: "Chiusa",
            RECONCILED: "Riconciliata",
          };
          const status = params.value as string;
          return <Chip label={statusLabels[status] || status} color={statusColors[status] || "default"} size="small" />;
        },
      },
    ],
    [theme.palette.success.light, theme.palette.success.contrastText, theme.palette.warning.light, theme.palette.warning.contrastText, theme.palette.error.light, theme.palette.error.contrastText]
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ListToolbar onNew={handleNew} onDelete={handleDelete} />
      <Box sx={{ marginTop: 1, paddingX: 2 }}>
        <Typography id="view-title" variant="h5" gutterBottom>
          {title}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, paddingX: 2, paddingBottom: 2 }}>
        <Datagrid items={cashRegisters || []} columnDefs={columnDefs} height="100%" loading={loading} onGridReady={handleGridReady} onRowDoubleClicked={handleRowDoubleClicked} presentation />
      </Box>
    </Box>
  );
}

export default CashRegisterList;
