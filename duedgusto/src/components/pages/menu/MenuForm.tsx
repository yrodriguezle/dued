import React from 'react';
import Box from '@mui/material/Box';
import { MenuNonNull } from '../../common/form/searchbox/searchboxOptions/menuSearchboxOptions';
import Datagrid from '../../common/datagrid/Datagrid';
import { useFormikContext } from 'formik';

interface MenuFormProps {
  menus: MenuNonNull[];
}

const MenuForm: React.FC<MenuFormProps> = ({ menus }) => {
  const { status } = useFormikContext();
  
  const getNewRow = (): MenuNonNull => ({
    __typename: "Menu",
    menuId: 0,
    parentMenuId: 0,
    title: "",
    path: "",
    icon: "",
    isVisible: true,
    filePath: "",
    viewName: "",
  });

  return (
    <Box sx={{ marginTop: 1, paddingX: 1, height: '80vh' }}>
      <Datagrid
        height="100%"
        items={menus}
        getRowId={({ data }) => data.menuId.toString()}
        singleClickEdit
        treeData
        treeDataParentIdField="parentMenuId"
        readOnly={status.isFormLocked as boolean}
        getNewRow={getNewRow}
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
      />
    </Box>
  );
};

export default MenuForm;
