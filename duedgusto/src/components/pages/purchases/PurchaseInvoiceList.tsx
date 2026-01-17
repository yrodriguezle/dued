import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Paper } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent } from "ag-grid-community";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useGetAll from "../../../graphql/common/useGetAll";
import { purchaseInvoiceFragment } from "../../../graphql/suppliers/fragments";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import { useMutation } from "@apollo/client";
import { mutationDeletePurchaseInvoice } from "../../../graphql/purchases/mutations";

type PurchaseInvoiceNonNull = Exclude<PurchaseInvoice, null>;

function PurchaseInvoiceList() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<PurchaseInvoiceNonNull>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<PurchaseInvoiceNonNull>[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const onConfirm = useConfirm();

  const [deleteInvoice] = useMutation(mutationDeletePurchaseInvoice);

  useEffect(() => {
    setTitle("Fatture Acquisto");
  }, [setTitle]);

  const { data: invoices } = useGetAll<PurchaseInvoiceNonNull>({
    fragment: purchaseInvoiceFragment,
    queryName: "purchaseInvoices",
    fragmentBody: "...PurchaseInvoiceFragment",
    fetchPolicy: "network-only",
    skip: false,
  });

  // Force re-fetch by changing key
  const refetch = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // This effect runs when refreshKey changes, forcing a re-mount of useGetAll
  }, [refreshKey]);

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<PurchaseInvoiceNonNull>>) => {
    gridRef.current = event;

    event.api.addEventListener("selectionChanged", () => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    });
  }, []);

  const handleNew = useCallback(() => {
    navigate("/gestionale/purchase-invoices-details");
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (selectedRows.length === 0) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Seleziona almeno una fattura da eliminare",
        autoClose: 2000,
        toastId: "warning-no-selection",
      });
      return;
    }

    const confirmed = await onConfirm({
      title: "Conferma eliminazione",
      content: `Sei sicuro di voler eliminare ${selectedRows.length} fattura/e selezionata/e?`,
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
    });

    if (!confirmed) {
      return;
    }

    try {
      for (const row of selectedRows) {
        await deleteInvoice({
          variables: { invoiceId: row.invoiceId },
        });
      }

      showToast({
        type: "success",
        position: "bottom-right",
        message: `${selectedRows.length} fattura/e eliminata/e con successo`,
        autoClose: 2000,
        toastId: "success-delete",
      });

      refetch();
    } catch {
      showToast({
        type: "error",
        position: "bottom-right",
        message: "Errore durante l'eliminazione",
        autoClose: 2000,
        toastId: "error-delete",
      });
    }
  }, [selectedRows, onConfirm, deleteInvoice, refetch]);

  const handleRowDoubleClick = useCallback((event: DatagridRowDoubleClickedEvent<PurchaseInvoiceNonNull>) => {
    if (event.data) {
      navigate(`/gestionale/purchase-invoices-details?invoiceId=${event.data.invoiceId}`);
    }
  }, [navigate]);

  const columnDefs = useMemo<DatagridColDef<PurchaseInvoiceNonNull>[]>(
    () => [
      {
        headerName: "ID",
        field: "invoiceId",
        width: 80,
        filter: "agNumberColumnFilter",
      },
      {
        headerName: "Numero Fattura",
        field: "invoiceNumber",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Fornitore",
        field: "supplier.businessName",
        width: 250,
        filter: "agTextColumnFilter",
        valueGetter: (params) => params.data?.supplier?.businessName || "",
      },
      {
        headerName: "Data Fattura",
        field: "invoiceDate",
        width: 130,
        filter: "agDateColumnFilter",
        valueFormatter: (params) => {
          if (!params.value) return "";
          return new Date(params.value).toLocaleDateString("it-IT");
        },
      },
      {
        headerName: "Scadenza",
        field: "dueDate",
        width: 130,
        filter: "agDateColumnFilter",
        valueFormatter: (params) => {
          if (!params.value) return "";
          return new Date(params.value).toLocaleDateString("it-IT");
        },
      },
      {
        headerName: "Imponibile",
        field: "taxableAmount",
        width: 120,
        filter: "agNumberColumnFilter",
        valueFormatter: (params) => {
          if (params.value == null) return "";
          return `€ ${params.value.toFixed(2)}`;
        },
      },
      {
        headerName: "IVA",
        field: "vatAmount",
        width: 100,
        filter: "agNumberColumnFilter",
        valueFormatter: (params) => {
          if (params.value == null) return "";
          return `€ ${params.value.toFixed(2)}`;
        },
      },
      {
        headerName: "Totale",
        field: "totalAmount",
        width: 120,
        filter: "agNumberColumnFilter",
        valueFormatter: (params) => {
          if (params.value == null) return "";
          return `€ ${params.value.toFixed(2)}`;
        },
      },
      {
        headerName: "Stato",
        field: "invoiceStatus",
        width: 150,
        cellRenderer: (params: { value: string }) => {
          const statusMap: Record<string, { label: string; color: "success" | "warning" | "error" }> = {
            PAGATA: { label: "Pagata", color: "success" },
            PARZIALMENTE_PAGATA: { label: "Parzialmente Pagata", color: "warning" },
            DA_PAGARE: { label: "Da Pagare", color: "error" },
          };
          const status = statusMap[params.value] || { label: params.value, color: "error" as const };
          return (
            <Chip
              label={status.label}
              color={status.color}
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
      <ListToolbar
        onNew={handleNew}
        onDelete={handleDelete}
        disabledDelete={selectedRows.length === 0}
      />

      <Paper sx={{ flex: 1, overflow: "hidden", mt: 2 }}>
        <Datagrid<PurchaseInvoiceNonNull>
          presentation
          height="100%"
          items={invoices}
          columnDefs={columnDefs}
          getRowId={({ data }) => data.invoiceId.toString()}
          rowSelection={{
            mode: "multiRow",
            headerCheckbox: true,
          }}
          onGridReady={handleGridReady}
          onRowDoubleClicked={handleRowDoubleClick}
        />
      </Paper>
    </Box>
  );
}

export default PurchaseInvoiceList;
