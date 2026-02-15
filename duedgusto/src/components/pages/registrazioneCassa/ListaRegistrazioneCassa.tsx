import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Typography, useTheme } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from "ag-grid-community";
import { getFormattedDate } from "../../../common/date/date";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useFetchData from "../../../graphql/common/useFetchData";
import { getRegistriCassa } from "../../../graphql/cashRegister/queries";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import { DatagridStatus } from "../../../common/globals/constants";
import useStore from "../../../store/useStore";

export type RegistroCassaWithStatus = RegistroCassa & {
  status: DatagridStatus;
};

function ListaRegistrazioneCassa() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { title, setTitle } = useContext(PageTitleContext);
  const getNextOperatingDate = useStore((state) => state.getNextOperatingDate);
  const gridRef = useRef<GridReadyEvent<DatagridData<RegistroCassaWithStatus>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<RegistroCassaWithStatus>[]>([]);
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Chiusure cassa");
  }, [setTitle]);

  const variables = useMemo(
    () => ({
      pageSize: 50,
      where: "",
      orderBy: "data desc",
    }),
    []
  );

  const { items: cashRegisters, loading } = useFetchData<RegistroCassa>({
    query: getRegistriCassa,
    variables,
    fetchPolicy: "network-only",
  });

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<RegistroCassaWithStatus>>) => {
    gridRef.current = event;

    event.api.addEventListener("selectionChanged", () => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    });
  }, []);

  const handleNew = useCallback(() => {
    const date = getNextOperatingDate();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    navigate(`/gestionale/cassa/${dateStr}`);
  }, [getNextOperatingDate, navigate]);

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
    (event: DatagridRowDoubleClickedEvent<RegistroCassaWithStatus>) => {
      const data = event.data;
      if (data?.data) {
        // Extract date in YYYY-MM-DD format
        const dateStr = data.data.split("T")[0];
        navigate(`/gestionale/cassa/${dateStr}`);
      }
    },
    [navigate]
  );

  const columnDefs = useMemo<DatagridColDef<RegistroCassaWithStatus>[]>(
    () => [
      {
        field: "data",
        headerName: "Data",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => getFormattedDate(params.value as string, "DD/MM/YYYY"),
      },
      {
        field: "utente.nomeUtente",
        headerName: "Operatore",
        width: 150,
      },
      {
        field: "totaleApertura",
        headerName: "Apertura",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "totaleChiusura",
        headerName: "Totale Cassa",
        width: 120,
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        colId: "incassoGiornaliero",
        headerName: "Totale (-) Apertura",
        width: 150,
        valueGetter: (params: ValueGetterParams<RegistroCassaWithStatus>) => {
          const cr = params.data;
          if (!cr) return 0;
          return (cr.totaleChiusura || 0) - (cr.totaleApertura || 0);
        },
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "incassoContanteTracciato",
        headerName: "Pago in contanti",
        width: 140,
        cellStyle: { backgroundColor: theme.palette.success.light, color: theme.palette.success.contrastText },
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "incassiElettronici",
        headerName: "Elettronico",
        width: 120,
        cellStyle: { backgroundColor: theme.palette.success.light, color: theme.palette.success.contrastText },
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "totaleVendite",
        headerName: "Totale Vendite",
        width: 140,
        cellStyle: { backgroundColor: theme.palette.warning.light, color: theme.palette.warning.contrastText },
        valueGetter: (params: ValueGetterParams<RegistroCassaWithStatus>) => {
          const cr = params.data;
          if (!cr) return 0;
          // Totale Vendite = (Totale Cassa - Apertura) + Elettronico
          return (cr.totaleChiusura || 0) - (cr.totaleApertura || 0) + (cr.incassiElettronici || 0);
        },
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "incassiFattura",
        headerName: "Pagamenti Fattura",
        width: 150,
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        colId: "speseTotali",
        headerName: "Spese Totali",
        width: 130,
        cellStyle: { backgroundColor: theme.palette.error.light, color: theme.palette.error.contrastText },
        valueGetter: (params: ValueGetterParams<RegistroCassaWithStatus>) => {
          const cr = params.data;
          if (!cr) return 0;
          return (cr.speseFornitori || 0) + (cr.speseGiornaliere || 0);
        },
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        colId: "ecc",
        headerName: "ECC",
        width: 120,
        valueGetter: (params: ValueGetterParams<RegistroCassaWithStatus>) => {
          const cr = params.data;
          if (!cr) return 0;
          // ECC = Totale Vendite - Pago in contanti - Elettronico
          const totalSales = (cr.totaleChiusura || 0) - (cr.totaleApertura || 0) + (cr.incassiElettronici || 0);
          return totalSales - (cr.incassoContanteTracciato || 0) - (cr.incassiElettronici || 0);
        },
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => {
          return `€ ${params.value?.toFixed(2) || "0.00"}`;
        },
      },
      {
        field: "stato",
        headerName: "Stato",
        width: 120,
        valueGetter: (params: ValueGetterParams<RegistroCassaWithStatus>) => {
          const cr = params.data;
          if (!cr || !cr.stato) return "DRAFT";
          // Se stato è un numero, converti a stringa corrispondente
          if (typeof cr.stato === "number") {
            const statusMap: Record<number, string> = {
              0: "DRAFT",
              1: "CLOSED",
              2: "RECONCILED",
            };
            return statusMap[cr.stato] || "DRAFT";
          }
          return cr.stato;
        },
        cellRenderer: (params: ICellRendererParams<RegistroCassaWithStatus>) => {
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
        <Datagrid
          items={(cashRegisters as unknown as RegistroCassaWithStatus[]) || []}
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

export default ListaRegistrazioneCassa;
