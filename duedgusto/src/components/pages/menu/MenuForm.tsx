import { useMemo } from "react";
import Box from "@mui/material/Box";
import * as MuiIcons from "@mui/icons-material";

import { MenuNonNull } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import Datagrid from "../../common/datagrid/Datagrid";
import { useFormikContext } from "formik";
import MenuIconRenderer from "../../common/datagrid/cellRenderers/MenuIconRenderer";
import { IconName } from "../../common/icon/IconFactory";

const iconNames = Object.keys(MuiIcons) as IconName[];

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
    <Box sx={{ marginTop: 1, paddingX: 1, height: "82vh" }}>
      <Datagrid
        height="100%"
        rowData={menus}
        getRowId={({ data }) => data.menuId.toString()}
        singleClickEdit
        treeData={readOnly}
        treeDataParentIdField="parentMenuId"
        readOnly={readOnly}
        getNewRow={getNewRow}
        groupDefaultExpanded={-1}
        autoGroupColumnDef={{
          headerName: "Voce di menù",
          field: "title",
          cellRenderer: "agGroupCellRenderer",
          filter: false,
          sortable: false,
          width: 200,
        }}
        columnDefs={[
          {
            headerName: "Id",
            field: "menuId",
            width: 50,
            editable: false,
            hide: readOnly,
          },
          {
            headerName: "Icona",
            field: "icon",
            sortable: true,
            width: 180,
            editable: !readOnly,
            cellRenderer: MenuIconRenderer,
            cellRendererParams: {
              fontSize: "small",
            },
            cellEditor: "agRichSelectCellEditor",
            cellEditorParams: {
              cellRenderer: MenuIconRenderer,
              values: iconNames,
              searchType: "match",
              allowTyping: true,
              filterList: true,
              highlightMatch: true,
              valueListMaxHeight: 220,
            },
          },
          {
            headerName: "Voce di menù",
            field: "title",
            width: 150,
            editable: !readOnly,
          },
          {
            headerName: "Nome view",
            field: "viewName",
            width: 150,
            editable: !readOnly,
          },
          {
            headerName: "Path",
            field: "path",
            sortable: true,
            width: 200,
            editable: !readOnly,
          },
          {
            headerName: "Visibile",
            field: "isVisible",
            width: 90,
          },
          {
            headerName: "Padre",
            field: "parentMenuId",
            width: 120,
            editable: !readOnly,
            hide: readOnly,
          },
        ]}
      />
    </Box>
  );
};

export default MenuForm;
