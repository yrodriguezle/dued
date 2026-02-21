import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Paper, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent } from "ag-grid-community";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useGetAll from "../../../graphql/common/useGetAll";
import { deliveryNoteFragment } from "../../../graphql/suppliers/fragments";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import { useMutation } from "@apollo/client";
import { mutationDeleteDeliveryNote } from "../../../graphql/suppliers/mutations";

type DeliveryNoteNonNull = Exclude<DeliveryNote, null>;

function DeliveryNoteList() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<DeliveryNoteNonNull>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<DeliveryNoteNonNull>[]>([]);
  const [filterNoInvoice, setFilterNoInvoice] = useState(false);
  const onConfirm = useConfirm();

  const [deleteDeliveryNote] = useMutation(mutationDeleteDeliveryNote);

  useEffect(() => {
    setTitle("DDT");
  }, [setTitle]);

  const { data: deliveryNotes, refetch } = useGetAll<DeliveryNoteNonNull>({
    fragment: deliveryNoteFragment,
    queryName: "deliveryNotes",
    fragmentBody: "...DeliveryNoteFragment",
    fetchPolicy: "network-only",
  });

  const filteredItems = useMemo(() => {
    if (!filterNoInvoice) return deliveryNotes;
    return deliveryNotes.filter((d) => !d.invoiceId);
  }, [deliveryNotes, filterNoInvoice]);

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<DeliveryNoteNonNull>>) => {
    gridRef.current = event;

    event.api.addEventListener("selectionChanged", () => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    });
  }, []);

  const handleNew = useCallback(() => {
    navigate("/gestionale/delivery-notes-details");
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (selectedRows.length === 0) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Seleziona almeno un DDT da eliminare",
        autoClose: 2000,
        toastId: "warning-no-selection",
      });
      return;
    }

    const confirmed = await onConfirm({
      title: "Conferma eliminazione",
      content: `Sei sicuro di voler eliminare ${selectedRows.length} DDT selezionato/i?`,
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
    });

    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(
        selectedRows.map((row) =>
          deleteDeliveryNote({ variables: { ddtId: row.ddtId } })
        )
      );

      showToast({
        type: "success",
        position: "bottom-right",
        message: `${selectedRows.length} DDT eliminato/i con successo`,
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
  }, [selectedRows, onConfirm, deleteDeliveryNote, refetch]);

  const handleRowDoubleClick = useCallback((event: DatagridRowDoubleClickedEvent<DeliveryNoteNonNull>) => {
    if (event.data) {
      navigate(`/gestionale/delivery-notes-details?ddtId=${event.data.ddtId}`);
    }
  }, [navigate]);

  const columnDefs = useMemo<DatagridColDef<DeliveryNoteNonNull>[]>(
    () => [
      {
        headerName: "ID",
        field: "ddtId",
        width: 80,
        filter: "agNumberColumnFilter",
      },
      {
        headerName: "Fornitore",
        field: "supplier",
        width: 250,
        filter: "agTextColumnFilter",
        valueGetter: (params) => params.data?.supplier?.businessName ?? "",
      },
      {
        headerName: "Numero DDT",
        field: "ddtNumber",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Data DDT",
        field: "ddtDate",
        width: 130,
        filter: "agDateColumnFilter",
        valueFormatter: (params) => {
          if (!params.value) return "";
          return new Date(params.value).toLocaleDateString("it-IT");
        },
      },
      {
        headerName: "Importo",
        field: "amount",
        width: 120,
        filter: "agNumberColumnFilter",
        valueFormatter: (params) =>
          params.value != null ? `\u20AC ${Number(params.value).toFixed(2)}` : "",
      },
      {
        headerName: "Fattura",
        field: "invoice",
        width: 150,
        filter: "agTextColumnFilter",
        valueGetter: (params) => params.data?.invoice?.invoiceNumber ?? "",
        cellRenderer: (params: { value: string }) => {
          if (!params.value) return "\u2014";
          return params.value;
        },
      },
      {
        headerName: "Note",
        field: "notes",
        flex: 1,
        filter: "agTextColumnFilter",
      },
    ],
    []
  );

  return (
    <>
      <ListToolbar
        onNew={handleNew}
        onDelete={handleDelete}
        disabledDelete={selectedRows.length === 0}
      />
      <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100vh - 64px - 48px)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
          <Typography id="view-title" variant="h5">
            DDT
          </Typography>
          <Chip
            label="Solo DDT senza fattura"
            color={filterNoInvoice ? "primary" : "default"}
            variant={filterNoInvoice ? "filled" : "outlined"}
            onClick={() => setFilterNoInvoice((prev) => !prev)}
            sx={{ cursor: "pointer" }}
          />
        </Box>
        <Paper sx={{ padding: 1, height: "calc(100% - 50px)" }}>
          <Datagrid<DeliveryNoteNonNull>
            presentation
            height="100%"
            items={filteredItems}
            columnDefs={columnDefs}
            getRowId={({ data }) => data.ddtId.toString()}
            rowSelection={{
              mode: "multiRow",
              headerCheckbox: true,
            }}
            onGridReady={handleGridReady}
            onRowDoubleClicked={handleRowDoubleClick}
          />
        </Paper>
      </Box>
    </>
  );
}

export default DeliveryNoteList;
