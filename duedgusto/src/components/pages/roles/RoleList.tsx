import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent } from "ag-grid-community";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useGetAll from "../../../graphql/common/useGetAll";
import { roleFragment } from "../../../graphql/roles/fragments";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";

type RoleNonNull = Exclude<Role, null>;

function RoleList() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<RoleNonNull>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<RoleNonNull>[]>([]);
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Lista ruoli");
  }, [setTitle]);

  const { data: roles, loading } = useGetAll<RoleNonNull>({
    fragment: roleFragment,
    queryName: "roles",
    fragmentBody: "...RoleFragment",
    fetchPolicy: "network-only",
  });

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<RoleNonNull>>) => {
    gridRef.current = event;

    event.api.addEventListener("selectionChanged", () => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    });
  }, []);

  const handleNew = useCallback(() => {
    navigate("/gestionale/roles-details");
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (selectedRows.length === 0) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Seleziona almeno un ruolo da eliminare",
        autoClose: 2000,
        toastId: "warning-no-selection",
      });
      return;
    }

    const confirmed = await onConfirm({
      title: "Conferma eliminazione",
      content: `Sei sicuro di voler eliminare ${selectedRows.length} ruolo/i selezionato/i?`,
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

  const handleRowDoubleClick = useCallback((event: DatagridRowDoubleClickedEvent<RoleNonNull>) => {
    if (event.data) {
      navigate(`/gestionale/roles-details?roleId=${event.data.roleId}`);
    }
  }, [navigate]);

  const columnDefs = useMemo<DatagridColDef<RoleNonNull>[]>(
    () => [
      {
        headerName: "ID",
        field: "roleId",
        width: 80,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Nome ruolo",
        field: "roleName",
        width: 200,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Descrizione",
        field: "roleDescription",
        width: 400,
        filter: true,
        sortable: true,
      },
    ],
    []
  );

  return (
    <>
      <ListToolbar
        hideNewButton={false}
        hideDeleteButton={false}
        disabledDelete={selectedRows.length === 0}
        onNew={handleNew}
        onDelete={handleDelete}
      />
      <Box className="scrollable-box" sx={{ marginTop: 1, paddingX: 2, overflow: "auto", height: "calc(100vh - 64px - 48px)" }}>
        <Typography id="view-title" variant="h5" gutterBottom>
          Lista ruoli
        </Typography>
        <Paper sx={{ padding: 1, height: "calc(100% - 50px)" }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              Caricamento...
            </Box>
          ) : (
            <Datagrid<RoleNonNull>
              presentation
              height="100%"
              items={roles}
              columnDefs={columnDefs}
              getRowId={({ data }) => data.roleId.toString()}
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

export default RoleList;
