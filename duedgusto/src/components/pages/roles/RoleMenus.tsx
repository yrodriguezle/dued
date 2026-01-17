import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFormikContext } from "formik";
import { Box } from "@mui/material";
import { GridApi, GridReadyEvent } from "ag-grid-community";
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
  const { status } = useFormikContext();
  const { isFormLocked } = useMemo(
    () => ({
      isFormLocked: status.isFormLocked as boolean,
      formStatus: status.formStatus as string,
    }),
    [status.formStatus, status.isFormLocked]
  );

  useEffect(() => {
    // Logic to disable checkboxes visually when form is locked (from previous restore)
    setTimeout(() => {
      if (isFormLocked) {
        const containers = document.querySelectorAll(
          'div[role="presentation"][data-ref="eCheckbox"].ag-labeled.ag-label-align-right.ag-checkbox.ag-input-field:not(.ag-disabled)'
        );
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
  }, [isFormLocked, menus]); // Added menus dependency to re-apply if data refreshes

  const syncSelection = useCallback(() => {
    if (!gridApiRef.current || gridApiRef.current.isDestroyed()) return;

    // Defer to ensure rows are rendered and grid is stable
    setTimeout(() => {
      if (!gridApiRef.current || gridApiRef.current.isDestroyed()) return;

      gridApiRef.current.forEachNode((node) => {
        if (!node.data) return;
        const shouldSelect = selectedIds?.includes(node.data.menuId) ?? false;

        if (node.isSelected() !== shouldSelect) {
          node.setSelected(shouldSelect);
        }
      });
    }, 100);
  }, [selectedIds]);

  const handleGridReady = useCallback((event: GridReadyEvent<DatagridData<MenuNonNull>>) => {
    gridApiRef.current = event.api;
    onGridReady(event);
    syncSelection();
  }, [onGridReady, syncSelection]);

  // Sync selection when selectedIds, menus, or lock state changes
  useEffect(() => {
    syncSelection();
  }, [syncSelection, isFormLocked, menus]);

  const columnDefs = useMemo<DatagridColDef<MenuNonNull>[]>(
    () => [
      { headerName: "Icona", field: "icon", filter: true, sortable: true, width: 150 },
      { headerName: "View", field: "viewName", filter: true, sortable: true, width: 150 },
      { headerName: "Path", field: "path", filter: true, sortable: true, width: 200 },
      { headerName: "Visibile", field: "isVisible", filter: true, sortable: true, width: 120 },
    ],
    []
  );

  const rowSelection = useMemo(() => ({
    mode: "multiRow" as const,
    groupSelects: "descendants" as const,
    headerCheckbox: !isFormLocked,
  }), [isFormLocked]);

  return (
    <Box sx={{ marginTop: 1, paddingX: 1 }}>
      <Datagrid<MenuNonNull>
        presentation
        height="60vh"
        items={menus}
        getRowId={({ data }) => data.menuId.toString()}
        treeData
        treeDataParentIdField="parentMenuId"
        groupDefaultExpanded={-1}
        groupLockGroupColumns={-1}
        autoGroupColumnDef={{
          headerName: "Titolo",
          field: "title",
          cellRenderer: "agGroupCellRenderer",
          filter: true,
          sortable: true,
          width: 200,
        }}
        columnDefs={columnDefs}
        rowSelection={rowSelection}
        onGridReady={handleGridReady}
        onRowDataUpdated={syncSelection}
      />
    </Box>
  );
}

export default RoleMenus;