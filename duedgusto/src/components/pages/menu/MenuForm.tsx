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

  const getNewRow = useCallback(
    (): MenuWithStatus => ({
      __typename: "Menu",
      id: 0,
      menuPadreId: null,
      titolo: "",
      percorso: "",
      icona: "",
      visibile: true,
      posizione: 0,
      percorsoFile: "",
      nomeVista: "",
      status: DatagridStatus.Added,
    }),
    []
  );

  const getNewRowOrUndefined = useMemo(() => (readOnly ? undefined : getNewRow), [readOnly, getNewRow]);

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

  const getRowId = useCallback(({ data }: { data: MenuNonNull }) => data.id.toString(), []);

  const autoGroupColumnDef = useMemo(
    () => ({
      headerName: "Voce di menù",
      field: "titolo",
      cellRenderer: "agGroupCellRenderer",
      filter: false,
      sortable: false,
      width: 200,
    }),
    []
  );

  const columnDefs = useMemo<DatagridColDef<MenuWithStatus>[]>(
    () => [
      {
        headerName: "Id",
        field: "id",
        width: 50,
        editable: false,
        hide: readOnly,
      },
      {
        headerName: "Posizione",
        field: "posizione",
        sortable: true,
        width: 100,
        editable: !readOnly,
        type: "numericColumn",
      },
      {
        headerName: "Icona",
        field: "icona",
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
            params.data.icona = params.newValue;
            params.context.gotoEditCell(params.node?.rowIndex, params.column);
            return true;
          }
          return false;
        },
      },
      {
        headerName: "Voce di menù",
        field: "titolo",
        width: 150,
        editable: !readOnly,
      },
      {
        headerName: "Nome view",
        field: "nomeVista",
        width: 150,
        editable: !readOnly,
      },
      {
        headerName: "Percorso",
        field: "percorso",
        sortable: true,
        width: 200,
        editable: !readOnly,
      },
      {
        headerName: "Visibile",
        field: "visibile",
        width: 90,
      },
      {
        headerName: "Padre",
        field: "menuPadreId",
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
        getRowId={getRowId}
        singleClickEdit
        treeData={readOnly}
        treeDataParentIdField="menuPadreId"
        readOnly={readOnly}
        getNewRow={getNewRowOrUndefined}
        groupDefaultExpanded={-1}
        autoGroupColumnDef={autoGroupColumnDef}
        onRowDataUpdated={handleRowDataUpdated}
        onCellValueChanged={handleCellValueChanged}
        columnDefs={columnDefs}
      />
    </Box>
  );
};

export default MenuForm;
