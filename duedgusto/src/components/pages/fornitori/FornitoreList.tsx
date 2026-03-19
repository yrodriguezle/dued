import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, Paper, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent } from "ag-grid-community";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useGetAll from "../../../graphql/common/useGetAll";
import { fornitoreFragment } from "../../../graphql/fornitori/fragments";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import { useMutation } from "@apollo/client";
import { mutationDeleteFornitore } from "../../../graphql/fornitori/mutations";

type FornitoreNonNull = Exclude<Fornitore, null>;

function FornitoreList() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<FornitoreNonNull>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<FornitoreNonNull>[]>([]);
  const onConfirm = useConfirm();

  const [deleteFornitore] = useMutation(mutationDeleteFornitore);

  useEffect(() => {
    setTitle("Fornitori");
  }, [setTitle]);

  const { data: fornitori, refetch } = useGetAll<FornitoreNonNull>({
    fragment: fornitoreFragment,
    queryName: "fornitori",
    fragmentBody: "...FornitoreFragment",
    fetchPolicy: "network-only",
  });

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<FornitoreNonNull>>) => {
    gridRef.current = event;

    event.api.addEventListener("selectionChanged", () => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    });
  }, []);

  const handleNew = useCallback(() => {
    navigate("/gestionale/fornitori-details");
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (selectedRows.length === 0) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Seleziona almeno un fornitore da eliminare",
        autoClose: 2000,
        toastId: "warning-no-selection",
      });
      return;
    }

    const confirmed = await onConfirm({
      title: "Conferma eliminazione",
      content: `Sei sicuro di voler eliminare ${selectedRows.length} fornitore/i selezionato/i?`,
      acceptLabel: "Elimina",
      cancelLabel: "Annulla",
    });

    if (!confirmed) {
      return;
    }

    try {
      await Promise.all(selectedRows.map((row) => deleteFornitore({ variables: { fornitoreId: row.fornitoreId } })));

      showToast({
        type: "success",
        position: "bottom-right",
        message: `${selectedRows.length} fornitore/i eliminato/i con successo`,
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
  }, [selectedRows, onConfirm, deleteFornitore, refetch]);

  const handleRowDoubleClick = useCallback(
    (event: DatagridRowDoubleClickedEvent<FornitoreNonNull>) => {
      if (event.data) {
        navigate(`/gestionale/fornitori-details?fornitoreId=${event.data.fornitoreId}`);
      }
    },
    [navigate]
  );

  const columnDefs = useMemo<DatagridColDef<FornitoreNonNull>[]>(
    () => [
      {
        headerName: "ID",
        field: "fornitoreId",
        width: 80,
        filter: "agNumberColumnFilter",
      },
      {
        headerName: "Ragione Sociale",
        field: "ragioneSociale",
        width: 250,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "P.IVA",
        field: "partitaIva",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Codice Fiscale",
        field: "codiceFiscale",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Email",
        field: "email",
        width: 200,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Telefono",
        field: "telefono",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Citta",
        field: "citta",
        width: 150,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Provincia",
        field: "provincia",
        width: 100,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Stato",
        field: "attivo",
        width: 100,
        cellRenderer: (params: { value: boolean }) => {
          return <Chip
            label={params.value ? "Attivo" : "Disattivo"}
            color={params.value ? "success" : "default"}
            size="small"
          />;
        },
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
      <Box
        className="scrollable-box"
        sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100dvh - 64px - 48px)" }}
      >
        <Typography
          id="view-title"
          variant="h5"
          gutterBottom
        >
          Fornitori
        </Typography>
        <Paper sx={{ padding: 1, height: "calc(100% - 50px)" }}>
          <Datagrid<FornitoreNonNull>
            gridId="fornitore-list"
            presentation
            height="100%"
            items={fornitori}
            columnDefs={columnDefs}
            getRowId={({ data }) => data.fornitoreId.toString()}
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

export default FornitoreList;
