import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Typography } from "@mui/material";
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
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<CashRegister>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<CashRegister>[]>([]);
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Lista Chiusure Cassa");
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
    navigate("/gestionale/cassa/details");
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
      if (data?.registerId) {
        navigate(`/gestionale/cassa/details/${data.registerId}`);
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
        headerName: "Chiusura",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "totalSales",
        headerName: "Vendite Totali",
        width: 140,
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "cashSales",
        headerName: "Contanti",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "electronicPayments",
        headerName: "Elettronici",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "difference",
        headerName: "Differenza",
        width: 120,
        cellStyle: () => {
          return null;
        },
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          const value = (params.value as number) || 0;
          const color = Math.abs(value) > 5 ? (value > 0 ? "#ff9800" : "#f44336") : undefined;
          if (color) {
            // Apply color through CSS if needed
          }
          return `€ ${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
        },
      },
      {
        field: "status",
        headerName: "Stato",
        width: 120,
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
          return (
            <Chip
              label={statusLabels[status] || status}
              color={statusColors[status] || "default"}
              size="small"
            />
          );
        },
      },
    ],
    []
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ListToolbar onNew={handleNew} onDelete={handleDelete} />
      <Box sx={{ marginTop: 1, paddingX: 2 }}>
        <Typography id="view-title" variant="h5" gutterBottom>
          Lista Chiusure Cassa
        </Typography>
      </Box>
      <Box sx={{ flex: 1, paddingX: 2, paddingBottom: 2 }}>
        <Datagrid
          items={cashRegisters || []}
          columnDefs={columnDefs}
          height="100%"
          loading={loading}
          onGridReady={handleGridReady}
          onRowDoubleClicked={handleRowDoubleClicked}
          presentation
        />
      </Box>
    </Box>
  );
}

export default CashRegisterList;
