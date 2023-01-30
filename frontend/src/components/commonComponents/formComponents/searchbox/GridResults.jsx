import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-enterprise';
import 'ag-grid-community/dist/styles/ag-grid.min.css';
import 'ag-grid-community/dist/styles/ag-theme-balham.min.css';
import 'ag-grid-community/dist/styles/ag-theme-balham-dark.min.css';
import { useSelector } from 'react-redux';
import { Alert } from '@mui/material';

import ToggleRenderer from '../../grid/toggleRenderer/ToggleRenderer';
import italian from '../../grid/i18n/italian';
import useDebouncedCallback from '../../hooks/useDebouncedCallback';

const navigateToNextCell = (params) => {
  const previousCell = params.previousCellPosition;
  const suggestedNextCell = params.nextCellPosition;
  switch (params.key) {
    case 'ArrowDown':
      params.api.forEachNode((node) => {
        if (previousCell.rowIndex + 1 === node.rowIndex) {
          node.setSelected(true);
        }
      });
      return suggestedNextCell;
    case 'ArrowUp':
      params.api.forEachNode((node) => {
        if (previousCell.rowIndex - 1 === node.rowIndex) {
          node.setSelected(true);
        }
      });
      return suggestedNextCell;
    case 'ArrowLeft':
    case 'ArrowRight':
      params.api.forEachNode((node) => {
        if (previousCell.rowIndex === node.rowIndex) {
          node.setSelected(true);
        }
      });
      return suggestedNextCell;
    default:
      return previousCell;
  }
};

function GridResults({
  searchBoxId,
  isEditor,
  userID,
  lookup,
  items,
  viewName,
  viewSettingsID,
  settings,
  fetchedCount,
  loadMore,
  containerHeight,
  onGridReady,
  onSelectedItem,
  setViewSetting,
}) {
  const gridRef = useRef();
  const [columnDefs, setColumDefs] = useState([]);
  const isThemeDark = useSelector((state) => state.settings?.darkTheme);

  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleGridReady = useCallback((params) => {
    gridRef.current = params;
    if (onGridReady) {
      onGridReady(params);
    }
    if (!settings.columnState) {
      params.api.sizeColumnsToFit();
    } else if (!params.api.destroyCalled) {
      setTimeout(() => {
        params.columnApi.applyColumnState({ state: settings.columnState });
      }, 0);
    }
  }, [onGridReady, settings]);

  useEffect(() => {
    const lookpuColumns = lookup.items
      .filter(({ visible }) => visible)
      .map(({
        columnName,
        fieldName,
        visible,
        ...rest
      }) => ({
        headerName: columnName,
        colId: fieldName,
        field: fieldName,
        ...rest,
      }));
    if (lookpuColumns?.length && mounted.current) {
      setColumDefs(lookpuColumns);
    }
  }, [lookup.items]);

  const handleRowSelected = useCallback((params) => {
    const lastFocusedCell = params.api.getFocusedCell();
    if (!lastFocusedCell) {
      const [node] = params.api.getSelectedNodes();
      if (node) {
        const [firstColum] = params.columnApi.getAllDisplayedColumns();
        const colId = firstColum && firstColum.colId;
        params.api.setFocusedCell(node.rowIndex, colId);
      }
    }
  }, []);

  const handleRowDoubleClicked = useCallback(
    ({ data, event }) => {
      onSelectedItem({
        key: data[lookup.id],
        ...data,
      }, event);
    },
    [lookup.id, onSelectedItem],
  );

  const handleCellKeyDown = useCallback(
    ({ data, event }) => {
      if (event.key === 'Enter') {
        onSelectedItem({
          key: data[lookup.id],
          ...data,
        }, event);
      }
    },
    [lookup.id, onSelectedItem],
  );

  const debouncedScrollHandler = useDebouncedCallback(
    ({ direction, ...params }) => {
      if (direction === 'vertical' && params.api.getLastDisplayedRow() + 1 === fetchedCount) {
        loadMore(params);
      }
    },
    [fetchedCount, loadMore],
    300,
  );

  const debouncedGridColumnStateChangedHandler = useDebouncedCallback(
    ({ source, ...params }) => {
      const blackListSource = [
        'gridInitializing',
        'api',
      ];
      if (!blackListSource.includes(source) && !params.api.destroyCalled && setViewSetting && mounted.current) {
        const searchBoxDomElement = document.getElementById(searchBoxId);
        if (searchBoxDomElement) {
          searchBoxDomElement.focus();
        }
        const columnState = params.columnApi.getColumnState();
        setViewSetting({
          viewSettingsID,
          objectType: 0,
          objectID: userID,
          viewName,
          settingValueType: 0,
          controlName: 'searchBoxCallout',
          settingName: searchBoxId,
          settingValue: JSON.stringify({
            ...settings,
            columnState,
          }),
        });
      }
    },
    [searchBoxId, setViewSetting, settings, userID, viewName, viewSettingsID],
    200,
  );

  const gridHeight = useMemo(() => (containerHeight || (isEditor && '20vh') || '30vh'), [containerHeight, isEditor]);

  return (
    <div
      className={isThemeDark ? 'ag-theme-balham-dark' : 'ag-theme-balham'}
      style={{ height: items.length ? gridHeight : 30, minWidth: global.SEARCHBOX_CONTAINER_MIN_WIDTH }}
    >
      {
        items.length ? (
          <AgGridReact
            suppressContextMenu
            localeText={italian}
            domLayout="normal"
            rowSelection="single"
            rowData={items}
            columnDefs={columnDefs}
            defaultColDef={{
              wrapText: true,
              lockPinned: true,
              resizable: true,
              suppressMovable: true,
              wrapHeaderText: true,
              autoHeaderHeight: true,
            }}
            components={{
              ToggleRenderer,
            }}
            onGridReady={handleGridReady}
            navigateToNextCell={navigateToNextCell}
            onRowSelected={handleRowSelected}
            onRowDoubleClicked={handleRowDoubleClicked}
            onCellKeyDown={handleCellKeyDown}
            onBodyScrollEnd={debouncedScrollHandler}
            onColumnResized={debouncedGridColumnStateChangedHandler}
            onColumnVisible={debouncedGridColumnStateChangedHandler}
          />
        ) : (
          <Alert severity="info">Nessun dato da visualizzare</Alert>
        )
      }
    </div>
  );
}

export default GridResults;
