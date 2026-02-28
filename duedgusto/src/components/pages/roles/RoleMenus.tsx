import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormikContext } from "formik";
import { Box, Chip, Paper, Typography } from "@mui/material";
import { GridApi, GridReadyEvent, RowSelectedEvent } from "ag-grid-community";
import Datagrid from "../../common/datagrid/Datagrid";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import { DatagridColDef, DatagridData } from "../../common/datagrid/@types/Datagrid";

interface RoleMenusProps {
  menus: MenuNonNull[];
  onGridReady: (event: GridReadyEvent<DatagridData<MenuNonNull>>) => void;
  selectedIds?: number[];
}

function RoleMenus({ menus, onGridReady, selectedIds }: RoleMenusProps) {
  const gridApiRef = useRef<GridApi<DatagridData<MenuNonNull>> | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const { status } = useFormikContext();
  const { isFormLocked } = useMemo(
    () => ({
      isFormLocked: status.isFormLocked as boolean,
      formStatus: status.formStatus as string,
    }),
    [status.formStatus, status.isFormLocked]
  );

  const updateSelectedCount = useCallback(() => {
    if (!gridApiRef.current || gridApiRef.current.isDestroyed()) return;
    setSelectedCount(gridApiRef.current.getSelectedRows().length);
  }, []);

  useEffect(() => {
    // Logic to disable checkboxes visually when form is locked (from previous restore)
    setTimeout(() => {
      if (isFormLocked) {
        const containers = document.querySelectorAll('div[role="presentation"][data-ref="eCheckbox"].ag-labeled.ag-label-align-right.ag-checkbox.ag-input-field:not(.ag-disabled)');
        containers.forEach((container) => {
          container.classList.add("ag-disabled");
          container.setAttribute("data-selection", "true");

          const wrapper = container.querySelector(".ag-wrapper.ag-input-wrapper.ag-checkbox-input-wrapper");
          const checkbox = wrapper?.querySelector('input[type="checkbox"]');
          if (wrapper && checkbox && checkbox instanceof HTMLInputElement) {
            wrapper.classList.add("ag-disabled");
            checkbox.disabled = true;
          }
        });
      } else {
        const containers = document.querySelectorAll('div[data-selection="true"].ag-disabled');
        containers.forEach((container) => {
          container.classList.remove("ag-disabled");
          container.removeAttribute("data-selection");

          const wrapper = container.querySelector(".ag-wrapper.ag-input-wrapper.ag-checkbox-input-wrapper");
          const checkbox = wrapper?.querySelector('input[type="checkbox"]');
          if (wrapper && checkbox && checkbox instanceof HTMLInputElement) {
            wrapper.classList.remove("ag-disabled");
            checkbox.disabled = false;
          }
        });
      }
    }, 0);
  }, [isFormLocked, menus]);

  const syncSelection = useCallback(() => {
    if (!gridApiRef.current || gridApiRef.current.isDestroyed()) return;

    // Defer to ensure rows are rendered and grid is stable
    setTimeout(() => {
      if (!gridApiRef.current || gridApiRef.current.isDestroyed()) return;

      gridApiRef.current.forEachNode((node) => {
        if (!node.data) return;
        const shouldSelect = selectedIds?.includes(node.data.id) ?? false;

        if (node.isSelected() !== shouldSelect) {
          node.setSelected(shouldSelect);
        }
      });
      updateSelectedCount();
    }, 100);
  }, [selectedIds, updateSelectedCount]);

  const handleGridReady = useCallback(
    (event: GridReadyEvent<DatagridData<MenuNonNull>>) => {
      gridApiRef.current = event.api;
      onGridReady(event);
      syncSelection();
    },
    [onGridReady, syncSelection]
  );

  const handleRowSelected = useCallback(
    (_event: RowSelectedEvent<DatagridData<MenuNonNull>>) => {
      updateSelectedCount();
    },
    [updateSelectedCount]
  );

  // Sync selection when selectedIds, menus, or lock state changes
  useEffect(() => {
    syncSelection();
  }, [syncSelection, isFormLocked, menus]);

  const columnDefs = useMemo<DatagridColDef<MenuNonNull>[]>(
    () => [
      { headerName: "Icona", field: "icona", filter: true, sortable: true, width: 150 },
      { headerName: "Vista", field: "nomeVista", filter: true, sortable: true, width: 150 },
      { headerName: "Percorso", field: "percorso", filter: true, sortable: true, width: 200 },
      {
        headerName: "Visibile",
        field: "visibile",
        filter: true,
        sortable: true,
        width: 120,
        cellRenderer: ({ value }: { value: boolean }) => <Chip label={value ? "Si" : "No"} size="small" color={value ? "success" : "default"} variant="outlined" />,
      },
    ],
    []
  );

  const rowSelection = useMemo(
    () => ({
      mode: "multiRow" as const,
      groupSelects: "descendants" as const,
      headerCheckbox: !isFormLocked,
    }),
    [isFormLocked]
  );

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            Permessi Menu
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Seleziona i menu accessibili per questo ruolo
          </Typography>
        </Box>
        {selectedCount > 0 && <Chip label={`${selectedCount} menu selezionat${selectedCount === 1 ? "o" : "i"}`} size="small" color="primary" variant="outlined" />}
      </Box>
      <Datagrid<MenuNonNull>
        presentation
        height="60vh"
        items={menus}
        getRowId={({ data }) => data.id.toString()}
        treeData
        treeDataParentIdField="menuPadreId"
        groupDefaultExpanded={-1}
        groupLockGroupColumns={-1}
        autoGroupColumnDef={{
          headerName: "Titolo",
          field: "titolo",
          cellRenderer: "agGroupCellRenderer",
          filter: true,
          sortable: true,
          width: 200,
        }}
        columnDefs={columnDefs}
        rowSelection={rowSelection}
        onGridReady={handleGridReady}
        onRowSelected={handleRowSelected}
        onRowDataUpdated={syncSelection}
      />
    </Paper>
  );
}

export default RoleMenus;
