import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent, ValueFormatterParams } from "ag-grid-community";
import dayjs from "dayjs";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useFetchData from "../../../graphql/common/useFetchData";
import { cashRegisterFragment } from "../../../graphql/cashRegister/fragments";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
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

  const { data: cashRegisters, loading } = useFetchData<CashRegister>({
    fragment: cashRegisterFragment,
    queryName: "cashRegistersConnection",
    schemaPath: "cashManagement",
    fragmentBody: "...CashRegisterFragment",
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
    navigate("/gestionale/cassa/new");
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
      navigate(`/gestionale/cassa/${event.data.registerId}`);
    },
    [navigate]
  );

  const columnDefs = useMemo<DatagridColDef<CashRegister>[]>(
    () => [
      {
        field: "date",
        headerName: "Data",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          return dayjs(params.value).format("DD/MM/YYYY");
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
        cellStyle: (params) => {
          if (Math.abs(params.value) > 5) {
            return { color: params.value > 0 ? "#ff9800" : "#f44336", fontWeight: "bold" };
          }
          return {};
        },
        valueFormatter: (params: ValueFormatterParams<CashRegister>) => {
          const value = params.value || 0;
          return `€ ${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
        },
      },
      {
        field: "status",
        headerName: "Stato",
        width: 120,
        cellRenderer: (params: { value: CashRegisterStatus }) => {
          const statusColors = {
            DRAFT: "default",
            CLOSED: "success",
            RECONCILED: "primary",
          };
          const statusLabels = {
            DRAFT: "Bozza",
            CLOSED: "Chiusa",
            RECONCILED: "Riconciliata",
          };
          return (
            <Chip
              label={statusLabels[params.value]}
              color={statusColors[params.value] as "default" | "success" | "primary"}
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
          rowData={cashRegisters}
          columnDefs={columnDefs}
          loading={loading}
          onGridReady={handleGridReady}
          onRowDoubleClicked={handleRowDoubleClicked}
        />
      </Box>
    </Box>
  );
}

export default CashRegisterList;
