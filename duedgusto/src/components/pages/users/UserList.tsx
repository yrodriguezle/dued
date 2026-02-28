import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent } from "ag-grid-community";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useGetAll from "../../../graphql/common/useGetAll";
import { utenteFragment } from "../../../graphql/utente/fragment";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";

type UtenteNonNull = Exclude<Utente, null>;

function UserList() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<UtenteNonNull>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<UtenteNonNull>[]>([]);
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Lista utenti");
  }, [setTitle]);

  const { data: utenti, loading } = useGetAll<UtenteNonNull>({
    fragment: utenteFragment,
    queryName: "utenti",
    fragmentBody: "...UtenteFragment",
    fetchPolicy: "network-only",
  });

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<UtenteNonNull>>) => {
    gridRef.current = event;

    event.api.addEventListener("selectionChanged", () => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    });
  }, []);

  const handleNew = useCallback(() => {
    navigate("/gestionale/users-details");
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (selectedRows.length === 0) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Seleziona almeno un utente da eliminare",
        autoClose: 2000,
        toastId: "warning-no-selection",
      });
      return;
    }

    const confirmed = await onConfirm({
      title: "Conferma eliminazione",
      content: `Sei sicuro di voler eliminare ${selectedRows.length} utente/i selezionato/i?`,
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
        autoClose: 2000,
        toastId: "error-delete",
      });
    }
  }, [selectedRows, onConfirm]);

  const handleRowDoubleClick = useCallback(
    (event: DatagridRowDoubleClickedEvent<UtenteNonNull>) => {
      if (event.data) {
        navigate(`/gestionale/users-details?utenteId=${event.data.id}`);
      }
    },
    [navigate]
  );

  const columnDefs = useMemo<DatagridColDef<UtenteNonNull>[]>(
    () => [
      {
        headerName: "ID",
        field: "id",
        width: 80,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Nome utente",
        field: "nomeUtente",
        width: 180,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Nome",
        field: "nome",
        width: 150,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Cognome",
        field: "cognome",
        width: 150,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Ruolo",
        field: "ruolo.nome",
        width: 150,
        filter: true,
        sortable: true,
        valueGetter: (params) => params.data?.ruolo?.nome || "",
      },
      {
        headerName: "Descrizione",
        field: "descrizione",
        width: 250,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Disabilitato",
        field: "disabilitato",
        width: 120,
        filter: true,
        sortable: true,
        cellRenderer: (params: { value: boolean }) => (params.value ? "Sì" : "No"),
      },
    ],
    []
  );

  return (
    <>
      <ListToolbar hideNewButton={false} hideDeleteButton={false} disabledDelete={selectedRows.length === 0} onNew={handleNew} onDelete={handleDelete} />
      <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100vh - 64px - 48px)" }}>
        <Typography id="view-title" variant="h5" gutterBottom>
          Lista utenti
        </Typography>
        <Paper sx={{ padding: 1, height: "calc(100% - 50px)" }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>Caricamento...</Box>
          ) : (
            <Datagrid<UtenteNonNull>
              presentation
              height="100%"
              items={utenti}
              columnDefs={columnDefs}
              getRowId={({ data }) => data.id.toString()}
              rowSelection={{
                mode: "multiRow",
                headerCheckbox: true,
              }}
              onGridReady={handleGridReady}
              onRowDoubleClicked={handleRowDoubleClick}
            />
          )}
        </Paper>
      </Box>
    </>
  );
}

export default UserList;
