import { useMemo } from 'react';
import Box from '@mui/material/Box';
import { MenuNonNull } from '../../common/form/searchbox/searchboxOptions/menuSearchboxOptions';
import Datagrid from '../../common/datagrid/Datagrid';
import { useFormikContext } from 'formik';

interface MenuFormProps {
  menus: MenuNonNull[];
}

const MenuForm: React.FC<MenuFormProps> = ({ menus }) => {
  const { status } = useFormikContext();
  const readOnly = useMemo(() => status.isFormLocked as boolean, [status.isFormLocked]);

  const getNewRow = (): MenuNonNull => ({
    __typename: "Menu",
    menuId: 0,
    parentMenuId: null,
    title: "",
    path: "",
    icon: "",
    isVisible: true,
    filePath: "",
    viewName: "",
  });

  return (
    <Box sx={{ marginTop: 1, paddingX: 1, height: '83vh' }}>
      <Datagrid
        height="100%"
        items={menus}
        getRowId={({ data }) => data.menuId.toString()}
        singleClickEdit
        treeData={readOnly}
        treeDataParentIdField="parentMenuId"
        readOnly={readOnly}
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
          { headerName: 'Id', field: 'menuId', sortable: false, width: 120, editable: false, hide: readOnly },
          { headerName: 'Icona', field: 'icon', sortable: true, width: 150, editable: true },
          { headerName: 'View', field: 'viewName', sortable: true, width: 150 },
          { headerName: 'Path', field: 'path', sortable: true, width: 200, editable: true },
          { headerName: 'Visibile', field: 'isVisible', sortable: true, width: 120 },
          { headerName: 'Padre', field: 'parentMenuId', sortable: false, width: 120, editable: true, hide: readOnly },
        ]}
      />
    </Box>
  );
};

export default MenuForm;
