import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Typography, useTheme } from "@mui/material";
import { useNavigate } from "react-router";
import { useApolloClient, useMutation } from "@apollo/client";
import { GridReadyEvent, ICellRendererParams, ValueFormatterParams, ValueGetterParams } from "ag-grid-community";
import { toast } from "react-toastify";
import { getFormattedDate } from "../../../common/date/date";
import formatCurrency from "../../../common/bones/formatCurrency";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useFetchData from "../../../graphql/common/useFetchData";
import { getRegistriCassa } from "../../../graphql/cashRegister/queries";
import { mutationEliminaRegistroCassa } from "../../../graphql/cashRegister/mutations";
import useRegistroCassaSubscription from "../../../graphql/subscriptions/useRegistroCassaSubscription";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import { DatagridStatus } from "../../../common/globals/constants";
import useStore from "../../../store/useStore";
import logger from "../../../common/logger/logger";

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
  const [eliminaRegistroCassa] = useMutation(mutationEliminaRegistroCassa);

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

  // Subscription: aggiorna la lista quando un registro cassa viene modificato
  const apolloClient = useApolloClient();
  const { data: registroUpdatedData } = useRegistroCassaSubscription();

  useEffect(() => {
    if (registroUpdatedData?.onRegistroCassaUpdated) {
      // Refetch la lista registri cassa per riflettere le modifiche
      apolloClient.refetchQueries({ include: ["GetRegistriCassa"] });
    }
  }, [registroUpdatedData, apolloClient]);

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
    if (selectedRows.length === 0) return;

    const confirmed = await onConfirm({
      title: "Conferma eliminazione",
      content: `Sei sicuro di voler eliminare ${selectedRows.length} registrazione/i cassa selezionata/e?`,
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
    });

    if (!confirmed) return;

    try {
      await Promise.all(
        selectedRows.map((row) =>
          eliminaRegistroCassa({
            variables: { registroCassaId: row.id },
            refetchQueries: ["GetRegistriCassa"],
          })
        )
      );
      toast.success(`${selectedRows.length} registrazione/i eliminata/e`, { position: "bottom-right" });
      setSelectedRows([]);
    } catch (error) {
      logger.error("Errore durante l'eliminazione:", error);
      toast.error("Errore durante l'eliminazione");
    }
  }, [selectedRows, onConfirm, eliminaRegistroCassa]);

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

  // Solo le righe in stato DRAFT sono selezionabili
  const isRowSelectable = useCallback((params: { data: DatagridData<RegistroCassaWithStatus> | undefined }) => {
    const stato = params.data?.stato;
    if (typeof stato === "number") return stato === 0;
    return stato === "DRAFT";
  }, []);

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
        type: "rightAligned",
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => formatCurrency(params.value),
      },
      {
        field: "totaleChiusura",
        headerName: "Totale Cassa",
        width: 120,
        type: "rightAligned",
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => formatCurrency(params.value),
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
        type: "rightAligned",
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => formatCurrency(params.value),
      },
      {
        field: "incassoContanteTracciato",
        headerName: "Pago in contanti",
        width: 140,
        cellStyle: { backgroundColor: theme.palette.success.light, color: theme.palette.success.contrastText },
        type: "rightAligned",
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => formatCurrency(params.value),
      },
      {
        field: "incassiElettronici",
        headerName: "Elettronico",
        width: 120,
        cellStyle: { backgroundColor: theme.palette.success.light, color: theme.palette.success.contrastText },
        type: "rightAligned",
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => formatCurrency(params.value),
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
        type: "rightAligned",
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => formatCurrency(params.value),
      },
      {
        field: "incassiFattura",
        headerName: "Pagamenti Fattura",
        width: 150,
        type: "rightAligned",
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => formatCurrency(params.value),
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
        type: "rightAligned",
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => formatCurrency(params.value),
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
        type: "rightAligned",
        valueFormatter: (params: ValueFormatterParams<RegistroCassaWithStatus>) => formatCurrency(params.value),
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
          return <Chip
            label={statusLabels[status] || status}
            color={statusColors[status] || "default"}
            size="small"
          />;
        },
      },
    ],
    [theme.palette.success.light, theme.palette.success.contrastText, theme.palette.warning.light, theme.palette.warning.contrastText, theme.palette.error.light, theme.palette.error.contrastText]
  );

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ListToolbar
        onNew={handleNew}
        onDelete={handleDelete}
        disabledDelete={selectedRows.length === 0}
      />
      <Box sx={{ marginTop: 1, paddingX: 2 }}>
        <Typography
          id="view-title"
          variant="h5"
          gutterBottom
        >
          {title}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, paddingX: 2, paddingBottom: 2 }}>
        <Datagrid
          gridId="registro-cassa-list"
          items={(cashRegisters as unknown as RegistroCassaWithStatus[]) || []}
          columnDefs={columnDefs}
          height="100%"
          loading={loading}
          onGridReady={handleGridReady}
          onRowDoubleClicked={handleRowDoubleClicked}
          rowSelection={{
            mode: "multiRow",
            headerCheckbox: true,
            isRowSelectable,
          }}
          presentation
        />
      </Box>
    </Box>
  );
}

export default ListaRegistrazioneCassa;
