import { useCallback, useMemo } from "react";
import Box from "@mui/material/Box";
import * as MuiIcons from "@mui/icons-material";
import { GridApi, GridReadyEvent } from "ag-grid-community";

import { MenuNonNull, MenuWithStatus } from "../../common/form/searchbox/searchboxOptions/menuSearchboxOptions";
import Datagrid from "../../common/datagrid/Datagrid";
import { useFormikContext } from "formik";
import MenuIconRenderer from "../../common/datagrid/cellRenderers/MenuIconRenderer";
import { IconName } from "../../common/icon/IconFactory";
import { DatagridCellValueChangedEvent, DatagridColDef, DatagridData, DatagridGridReadyEvent, DatagridRowDragEndEvent, DatagridRowDataUpdatedEvent } from "../../common/datagrid/@types/Datagrid";
import { FormikMenuValues } from "./MenuDetails";
import { DatagridStatus } from "../../../common/globals/constants";
import useDebouncedCallback from "../../common/debounced/useDebouncedCallback";
import showToast from "../../../common/toast/showToast";

const iconNames = Object.keys(MuiIcons) as IconName[];

function buildNodesMap(api: GridApi): Map<number, MenuNonNull> {
  const map = new Map<number, MenuNonNull>();
  api.forEachNode((node) => {
    if (node.data) {
      map.set(node.data.id, node.data as MenuNonNull);
    }
  });
  return map;
}

function isDescendantOf(
  nodeId: number,
  potentialParentId: number,
  nodesMap: Map<number, MenuNonNull>,
  visited: Set<number> = new Set()
): boolean {
  if (potentialParentId === nodeId) {
    return true;
  }
  if (visited.has(potentialParentId)) {
    return false;
  }
  const node = nodesMap.get(potentialParentId);
  const parentId = node?.menuPadreId ?? null;
  if (parentId === null || parentId === undefined) {
    return false;
  }
  return isDescendantOf(nodeId, parentId, nodesMap, new Set([...visited, potentialParentId]));
}

interface MenuFormProps {
  menus: MenuNonNull[];
  deletedRowIdsRef: React.MutableRefObject<number[]>;
  gridApiRef: React.MutableRefObject<GridReadyEvent | null>;
}

const MenuForm: React.FC<MenuFormProps> = ({ menus, deletedRowIdsRef, gridApiRef }) => {
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

  const sortedMenus = useMemo(() => [...menus].sort((a, b) => (a.posizione ?? 0) - (b.posizione ?? 0)), [menus]);

  const isGridDirty = useCallback(
    (gridData: DatagridData<MenuWithStatus>[]) => {
      const hasModifiedOrAdded = gridData.some(({ status }) => status === DatagridStatus.Modified || status === DatagridStatus.Added);
      const hasDeletedRows = gridData.length !== menus.length;
      return hasModifiedOrAdded || hasDeletedRows;
    },
    [menus.length]
  );

  const handleGridReady = useCallback(
    (event: DatagridGridReadyEvent<MenuWithStatus>) => {
      gridApiRef.current = event;
    },
    [gridApiRef]
  );

  const handleRowsDeleted = useCallback(
    (deletedRows: DatagridData<MenuWithStatus>[]) => {
      deletedRows.forEach((row) => {
        if (row.id > 0) {
          deletedRowIdsRef.current.push(row.id);
        }
      });
    },
    [deletedRowIdsRef]
  );

  const handleRowDataUpdated = useCallback(
    (event: DatagridRowDataUpdatedEvent<MenuWithStatus>) => {
      const gridData: DatagridData<MenuWithStatus>[] = event.context.getGridData();
      setFieldValue("gridDirty", isGridDirty(gridData));
    },
    [setFieldValue, isGridDirty]
  );

  const handleCellValueChanged = useDebouncedCallback(
    (event: DatagridCellValueChangedEvent<MenuWithStatus>) => {
      const gridData: DatagridData<MenuWithStatus>[] = event.context.getGridData();
      setFieldValue("gridDirty", isGridDirty(gridData));
    },
    [isGridDirty],
    1
  );

  const handleRowDragEnd = useCallback(
    (event: DatagridRowDragEndEvent<MenuWithStatus>) => {
      const { node, overNode, api } = event;
      if (!node.data) {
        return;
      }

      const draggedData = node.data;
      const overData = overNode?.data ?? null;

      // Early return: drop su se stesso
      if (overData && draggedData.id === overData.id) {
        return;
      }

      const newParentId = overData ? overData.id : null;

      // Early return: menuPadreId non cambia
      if (draggedData.menuPadreId === newParentId) {
        return;
      }

      // Validazione anti-ciclo (solo se il nuovo parent non e null)
      if (newParentId !== null) {
        const nodesMap = buildNodesMap(api);
        if (isDescendantOf(draggedData.id, newParentId, nodesMap)) {
          showToast({
            type: "warn",
            message: "Impossibile spostare un elemento sotto un proprio discendente.",
          });
          return;
        }
      }

      // Aggiorna menuPadreId e marca come modificato
      draggedData.menuPadreId = newParentId;
      draggedData.status = DatagridStatus.Modified;
      api.applyTransaction({ update: [draggedData] });
      setFieldValue("gridDirty", true);
    },
    [setFieldValue]
  );

  const getRowId = useCallback(({ data }: { data: MenuNonNull }) => data.id.toString(), []);

  const autoGroupColumnDef = useMemo<DatagridColDef<MenuNonNull>>(
    () => ({
      headerName: "Voce di menù",
      field: "titolo",
      cellRenderer: "agGroupCellRenderer",
      filter: false,
      sortable: false,
      width: 200,
      rowDrag: !readOnly,
    }),
    [readOnly]
  );

  const columnDefs = useMemo<DatagridColDef<MenuNonNull>[]>(
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
        editable: !readOnly,
        cellDataType: "boolean",
        cellRenderer: "agCheckboxCellRenderer",
        cellEditor: "agCheckboxCellEditor",
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
        gridId="menu-form-tree"
        height="100%"
        items={sortedMenus}
        getRowId={getRowId}
        singleClickEdit
        treeData
        treeDataParentIdField="menuPadreId"
        readOnly={readOnly}
        getNewRow={getNewRowOrUndefined}
        groupDefaultExpanded={-1}
        autoGroupColumnDef={autoGroupColumnDef}
        rowDragManaged={!readOnly}
        onGridReady={handleGridReady}
        onRowDragEnd={handleRowDragEnd}
        onRowDataUpdated={handleRowDataUpdated}
        onCellValueChanged={handleCellValueChanged}
        onRowsDeleted={handleRowsDeleted}
        columnDefs={columnDefs}
      />
    </Box>
  );
};

export default MenuForm;
