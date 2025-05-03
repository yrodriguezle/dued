
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormikContext } from "formik";
import { Box } from "@mui/material";
import { GridReadyEvent, RowGroupOpenedEvent } from "ag-grid-community";
import AgGrid from "../../common/datagrid/AgGrid";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";

interface RoleMenusProps {
  menus: MenuNonNull[];
  onGridReady: (event: GridReadyEvent<MenuNonNull>) => void
}

function RoleMenus({ menus, onGridReady }: RoleMenusProps) {
  const [opened, setOpened] = useState('');
  const { status } = useFormikContext();
  const readOnly = useMemo(() => status.isFormLocked as boolean, [status.isFormLocked]);

  useEffect(() => {
    setTimeout(() => {
      if (readOnly) {
        const containers = document.querySelectorAll('div[role="presentation"][data-ref="eCheckbox"].ag-labeled.ag-label-align-right.ag-checkbox.ag-input-field:not(.ag-disabled)');
        containers.forEach(container => {
          container.classList.add('ag-disabled');
          container.setAttribute('data-selection', 'true');

          const wrapper = container.querySelector('.ag-wrapper.ag-input-wrapper.ag-checkbox-input-wrapper');
          const checkbox = wrapper?.querySelector('input[type="checkbox"]');
          if (wrapper && checkbox && checkbox instanceof HTMLInputElement) {
            wrapper.classList.add('ag-disabled');
            checkbox.disabled = true;
          }
        });
      } else {
        const containers = document.querySelectorAll('div[data-selection="true"].ag-disabled');
        containers.forEach(container => {
          container.classList.remove('ag-disabled');
          container.removeAttribute('data-selection');

          const wrapper = container.querySelector('.ag-wrapper.ag-input-wrapper.ag-checkbox-input-wrapper');
          const checkbox = wrapper?.querySelector('input[type="checkbox"]');
          if (wrapper && checkbox && checkbox instanceof HTMLInputElement) {
            wrapper.classList.remove('ag-disabled');
            checkbox.disabled = false;
          }
        });
      }
    }, 0)
  }, [readOnly, opened]);

  const onRowGroupOpened = useCallback(
    (event: RowGroupOpenedEvent) => {
      const node = event.node;
      const nodeString = `${node.id} - ${node.group} - ${node.expanded}`;
      setOpened(nodeString);
    },
    [],
  );

  return (
    <Box sx={{ marginTop: 1, paddingX: 1, height: '60vh' }}>
      <AgGrid<MenuNonNull>
        rowData={menus}
        getRowId={({ data }) => data.menuId.toString()}
        treeData
        treeDataParentIdField="parentMenuId"
        groupDefaultExpanded={-1}
        groupLockGroupColumns={-1}
        autoGroupColumnDef={{
          headerName: 'Titolo',
          field: 'title',
          cellRenderer: 'agGroupCellRenderer',
          cellRendererParams: {
            // disables ↵ Enter to expand/collapse
            suppressEnterExpand: true,
            // disables double-click to expand/collapse
            suppressDoubleClickExpand: true,
          },
          filter: true,
          sortable: true,
          width: 200,
        }}
        onRowGroupOpened={onRowGroupOpened}
        columnDefs={[
          { headerName: 'Icona', field: 'icon', filter: true, sortable: true, width: 150 },
          { headerName: 'View', field: 'viewName', filter: true, sortable: true, width: 150 },
          { headerName: 'Path', field: 'path', filter: true, sortable: true, width: 200 },
          { headerName: 'Visibile', field: 'isVisible', filter: true, sortable: true, width: 120 },
        ]}
        rowSelection={{
          mode: "multiRow",
          groupSelects: "descendants",
          headerCheckbox: !readOnly
        }}
        onGridReady={onGridReady}
      />
    </Box>
  )
}

export default RoleMenus