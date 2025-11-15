import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Paper, Typography } from "@mui/material";
import { useNavigate } from "react-router";
import { GridReadyEvent } from "ag-grid-community";

import Datagrid from "../../common/datagrid/Datagrid";
import ListToolbar from "../../common/form/toolbar/ListToolbar";
import PageTitleContext from "../../layout/headerBar/PageTitleContext";
import useGetAll from "../../../graphql/common/useGetAll";
import { menuFragment } from "../../../graphql/menus/fragments";
import { DatagridColDef, DatagridData, DatagridRowDoubleClickedEvent } from "../../common/datagrid/@types/Datagrid";
import useConfirm from "../../common/confirm/useConfirm";
import showToast from "../../../common/toast/showToast";
import MenuIconRenderer from "../../common/datagrid/cellRenderers/MenuIconRenderer";

type MenuNonNull = Exclude<Menu, null>;

function MenuList() {
  const navigate = useNavigate();
  const { setTitle } = useContext(PageTitleContext);
  const gridRef = useRef<GridReadyEvent<DatagridData<MenuNonNull>> | null>(null);
  const [selectedRows, setSelectedRows] = useState<DatagridData<MenuNonNull>[]>([]);
  const onConfirm = useConfirm();

  useEffect(() => {
    setTitle("Lista menu");
  }, [setTitle]);

  const { data: menus, loading } = useGetAll<MenuNonNull>({
    fragment: menuFragment,
    queryName: "menus",
    fragmentBody: "...MenuFragment",
    fetchPolicy: "network-only",
  });

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<MenuNonNull>>) => {
    gridRef.current = event;

    event.api.addEventListener("selectionChanged", () => {
      const selected = event.api.getSelectedRows();
      setSelectedRows(selected);
    });
  }, []);

  const handleNew = useCallback(() => {
    navigate("/gestionale/menus-details");
  }, [navigate]);

  const handleDelete = useCallback(async () => {
    if (selectedRows.length === 0) {
      showToast({
        type: "warning",
        position: "bottom-right",
        message: "Seleziona almeno un menu da eliminare",
        autoClose: 2000,
        toastId: "warning-no-selection",
      });
      return;
    }

    const confirmed = await onConfirm({
      title: "Conferma eliminazione",
      content: `Sei sicuro di voler eliminare ${selectedRows.length} menu selezionato/i?`,
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

  const handleRowDoubleClick = useCallback((event: DatagridRowDoubleClickedEvent<MenuNonNull>) => {
    if (event.data) {
      navigate(`/gestionale/menus-details?menuId=${event.data.menuId}`);
    }
  }, [navigate]);

  const columnDefs = useMemo<DatagridColDef<MenuNonNull>[]>(
    () => [
      {
        headerName: "ID",
        field: "menuId",
        width: 80,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Icona",
        field: "icon",
        width: 100,
        filter: true,
        sortable: true,
        cellRenderer: MenuIconRenderer,
        cellRendererParams: {
          fontSize: "small",
        },
      },
      {
        headerName: "View",
        field: "viewName",
        width: 180,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Path",
        field: "path",
        width: 250,
        filter: true,
        sortable: true,
      },
      {
        headerName: "Visibile",
        field: "isVisible",
        width: 100,
        filter: true,
        sortable: true,
        cellRenderer: (params: { value: boolean }) => (params.value ? "Sì" : "No"),
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
          Lista menu
        </Typography>
        <Paper sx={{ padding: 1, height: "calc(100% - 50px)" }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              Caricamento...
            </Box>
          ) : (
            <Datagrid<MenuNonNull>
              presentation
              height="100%"
              items={menus}
              columnDefs={columnDefs}
              getRowId={({ data }) => data.menuId.toString()}
              treeData
              treeDataParentIdField="parentMenuId"
              groupDefaultExpanded={-1}
              autoGroupColumnDef={{
                headerName: "Titolo",
                field: "title",
                cellRenderer: "agGroupCellRenderer",
                filter: true,
                sortable: true,
                width: 250,
              }}
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

export default MenuList;
