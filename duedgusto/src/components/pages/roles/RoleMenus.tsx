import AgGrid from "../../common/datagrid/AgGrid";
import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import { Box } from "@mui/material";

interface RoleMenusProps {
  menus: MenuNonNull[];
}

function RoleMenus({ menus }: RoleMenusProps) {
  // const { status } = useFormikContext();
  return (
    <Box sx={{ marginTop: 1, paddingX: 1, height: '60vh' }}>
      <AgGrid<MenuNonNull>
        rowData={menus}
        getRowId={({ data }) => data.menuId.toString()}
        singleClickEdit
        treeData
        treeDataParentIdField="parentMenuId"
        groupDefaultExpanded={-1}
        autoGroupColumnDef={{
          headerName: 'Titolo',
          field: 'title',
          cellRenderer: 'agGroupCellRenderer',
          filter: true,
          sortable: true,
          width: 200,
        }}
        columnDefs={[
          { headerName: 'Icona', field: 'icon', filter: true, sortable: true, width: 150, editable: true },
          { headerName: 'View', field: 'viewName', filter: true, sortable: true, width: 150 },
          { headerName: 'Path', field: 'path', filter: true, sortable: true, width: 200, editable: true },
          { headerName: 'Visibile', field: 'isVisible', filter: true, sortable: true, width: 120 },
        ]}
        rowSelection={{
          mode: "multiRow",
          groupSelects: "descendants"
        }}
      />
    </Box>
  )
}

export default RoleMenus