import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import * as MuiIcons from "@mui/icons-material";

import { MenuNonNull, MenuWithStatus } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import Datagrid from "../../common/datagrid/Datagrid";
import { useFormikContext } from "formik";
import MenuIconRenderer from "../../common/datagrid/cellRenderers/MenuIconRenderer";
import { IconName } from "../../common/icon/IconFactory";
import { DatagridCellValueChangedEvent, DatagridColDef, DatagridData, DatagridRowDataUpdatedEvent } from "../../common/datagrid/@types/Datagrid";
import { FormikMenuValues } from "./MenuDetails";
import { DatagridStatus } from "../../../common/globals/constants";
import useDebouncedCallback from "../../common/debounced/useDebouncedCallback";

const iconNames = Object.keys(MuiIcons) as IconName[];

interface MenuFormProps {
  menus: MenuNonNull[];
}

const MenuForm: React.FC<MenuFormProps> = ({ menus }) => {
  const { status, setFieldValue } = useFormikContext<FormikMenuValues>();
  const readOnly = useMemo(() => status.isFormLocked as boolean, [status.isFormLocked]);

  const getNewRow = (): MenuWithStatus => ({
    __typename: "Menu",
    menuId: 0,
    parentMenuId: null,
    title: "",
    path: "",
    icon: "",
    isVisible: true,
    position: 0,
    filePath: "",
    viewName: "",
    status: DatagridStatus.Added,
  });

  const handleRowDataUpdated = useCallback(
    (event: DatagridRowDataUpdatedEvent<MenuWithStatus>) => {
      const gridData: DatagridData<MenuWithStatus>[] = event.context.getGridData();
      const dirty = gridData.some(({ status }) => status === DatagridStatus.Modified);
      setFieldValue("gridDirty", dirty);
    },
    [setFieldValue]
  );

  const handleCellValueChanged = useDebouncedCallback(
    (event: DatagridCellValueChangedEvent<MenuWithStatus>) => {
      const gridData: DatagridData<MenuWithStatus>[] = event.context.getGridData();
      const dirty = gridData.some(({ status }) => status === DatagridStatus.Modified);
      setFieldValue("gridDirty", dirty);
    },
    [],
    1
  );

  const columnDefs = useMemo<DatagridColDef<MenuWithStatus>[]>(
    () => [
      {
        headerName: "Id",
        field: "menuId",
        width: 50,
        editable: false,
        hide: readOnly,
      },
      {
        headerName: "Posizione",
        field: "position",
        sortable: true,
        width: 100,
        editable: !readOnly,
        type: "numericColumn",
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
        valueSetter: (params) => {
          if (params.newValue !== params.oldValue) {
            params.data.icon = params.newValue;
            params.context.gotoEditCell(params.node?.rowIndex, params.column);
            return true;
          }
          return false;
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
    ],
    [readOnly]
  );

  return (
    <Box sx={{ marginTop: 1, paddingX: 1, height: "80vh" }}>
      <Datagrid<MenuNonNull>
        height="100%"
        items={menus}
        getRowId={({ data }) => data.menuId.toString()}
        singleClickEdit
        treeData={readOnly}
        treeDataParentIdField="parentMenuId"
        readOnly={readOnly}
        getNewRow={readOnly ? undefined : getNewRow}
        groupDefaultExpanded={-1}
        autoGroupColumnDef={{
          headerName: "Voce di menù",
          field: "title",
          cellRenderer: "agGroupCellRenderer",
          filter: false,
          sortable: false,
          width: 200,
        }}
        onRowDataUpdated={handleRowDataUpdated}
        onCellValueChanged={handleCellValueChanged}
        columnDefs={columnDefs}
      />
    </Box>
  );
};

export default MenuForm;
