import {
  CellClickedEvent,
  CellContextMenuEvent,
  CellDoubleClickedEvent,
  CellEditingStartedEvent,
  CellEditingStoppedEvent,
  CellFocusedEvent,
  CellKeyDownEvent,
  CellMouseDownEvent,
  CellMouseOutEvent,
  CellMouseOverEvent,
  CellValueChangedEvent,
  ColDef,
  ColGroupDef,
  Column,
  ColumnEverythingChangedEvent,
  ColumnGroupOpenedEvent,
  ColumnMovedEvent,
  ColumnPinnedEvent,
  ColumnPivotChangedEvent,
  ColumnResizedEvent,
  ColumnRowGroupChangedEvent,
  ColumnValueChangedEvent,
  ColumnVisibleEvent,
  DragStartedEvent,
  DragStoppedEvent,
  FilterChangedEvent,
  FilterModifiedEvent,
  FilterOpenedEvent,
  FirstDataRenderedEvent,
  GridApi,
  GridColumnsChangedEvent,
  GridReadyEvent,
  GridSizeChangedEvent,
  IRowNode,
  ModelUpdatedEvent,
  NewColumnsLoadedEvent,
  PaginationChangedEvent,
  PasteEndEvent,
  PasteStartEvent,
  PinnedRowDataChangedEvent,
  RangeDeleteEndEvent,
  RangeDeleteStartEvent,
  RangeSelectionChangedEvent,
  RowClickedEvent,
  RowDataUpdatedEvent,
  RowDoubleClickedEvent,
  RowDragEndEvent,
  RowDragEnterEvent,
  RowDragLeaveEvent,
  RowDragMoveEvent,
  RowEditingStartedEvent,
  RowEditingStoppedEvent,
  RowGroupOpenedEvent,
  RowSelectedEvent,
  RowValueChangedEvent,
  SelectionChangedEvent,
  SortChangedEvent,
  ToolPanelVisibleChangedEvent,
  ViewportChangedEvent,
  VirtualColumnsChangedEvent,
  VirtualRowRemovedEvent,
} from "ag-grid-community";
import { AgGridReactProps } from "ag-grid-react";
import { DatagridStatus } from "../../../../common/globals/constants";

interface DatagridAuxData {
  status: DatagridStatus;
}

type DatagridData<T extends Record<string, unknown>> = DatagridAuxData & T & Record<string, unknown>;

interface IRowEvent<T extends Record<string, unknown>> {
  data?: DatagridData<T>;
  node: IRowNode<DatagridData<T>>;
  api: GridApi<DatagridData<T>>;
  column?: Column;
}

interface BaseDatagridProps<T extends Record<string, unknown>> extends AgGridReactProps<T> {
  height: string;
  onGridReady?: (event: GridReadyEvent<DatagridData<T>>) => void;
  columnDefs: ColDef<DatagridData<T>>[];
  addNewRowAt?: "top" | "bottom";
}
interface EditingModeProps<T extends Record<string, unknown>> extends BaseDatagridProps<T> {
  presentation?: undefined;
  getNewRow: () => T;
  readOnly: boolean;
}
interface PresentationModeProps<T extends Record<string, unknown>> extends BaseDatagridProps<T> {
  presentation: true;
  getNewRow?: never;
  readOnly?: never;
}
type DatagridProps<T extends Record<string, unknown>> = EditingModeProps<T> | PresentationModeProps<T>;

type ValidateRow<T extends Record<string, unknown>> = (node: IRowNode<DatagridData<T>>) => Promise<{ id: string }>;

// Base AG-Grid types wrapped with DatagridData
type DatagridAgGridProps<T> = AgGridReactProps<DatagridData<T>>;
type DatagridColDef<T> = ColDef<DatagridData<T>>;
type DatagridColGroupDef<T> = ColGroupDef<DatagridData<T>>;
type DatagridIRowEvent<T> = IRowEvent<DatagridData<T>>;

// Grid Events
type DatagridGridReadyEvent<T> = GridReadyEvent<DatagridData<T>>;
type DatagridGridSizeChangedEvent<T> = GridSizeChangedEvent<DatagridData<T>>;
type DatagridFirstDataRenderedEvent<T> = FirstDataRenderedEvent<DatagridData<T>>;

// Row Events
type DatagridRowDataUpdatedEvent<T> = RowDataUpdatedEvent<DatagridData<T>>;
type DatagridRowClickedEvent<T> = RowClickedEvent<DatagridData<T>>;
type DatagridRowDoubleClickedEvent<T> = RowDoubleClickedEvent<DatagridData<T>>;
type DatagridRowSelectedEvent<T> = RowSelectedEvent<DatagridData<T>>;
type DatagridRowEditingStartedEvent<T> = RowEditingStartedEvent<DatagridData<T>>;
type DatagridRowEditingStoppedEvent<T> = RowEditingStoppedEvent<DatagridData<T>>;
type DatagridRowValueChangedEvent<T> = RowValueChangedEvent<DatagridData<T>>;
type DatagridRowGroupOpenedEvent<T> = RowGroupOpenedEvent<DatagridData<T>>;
type DatagridVirtualRowRemovedEvent<T> = VirtualRowRemovedEvent<DatagridData<T>>;

// Row Drag Events
type DatagridRowDragEndEvent<T> = RowDragEndEvent<DatagridData<T>>;
type DatagridRowDragEnterEvent<T> = RowDragEnterEvent<DatagridData<T>>;
type DatagridRowDragLeaveEvent<T> = RowDragLeaveEvent<DatagridData<T>>;
type DatagridRowDragMoveEvent<T> = RowDragMoveEvent<DatagridData<T>>;

// Cell Events
type DatagridCellClickedEvent<T> = CellClickedEvent<DatagridData<T>>;
type DatagridCellDoubleClickedEvent<T> = CellDoubleClickedEvent<DatagridData<T>>;
type DatagridCellContextMenuEvent<T> = CellContextMenuEvent<DatagridData<T>>;
type DatagridCellValueChangedEvent<T> = CellValueChangedEvent<DatagridData<T>>;
type DatagridCellEditingStartedEvent<T> = CellEditingStartedEvent<DatagridData<T>>;
type DatagridCellEditingStoppedEvent<T> = CellEditingStoppedEvent<DatagridData<T>>;
type DatagridCellFocusedEvent<T> = CellFocusedEvent<DatagridData<T>>;
type DatagridCellKeyDownEvent<T> = CellKeyDownEvent<DatagridData<T>>;
type DatagridCellMouseOverEvent<T> = CellMouseOverEvent<DatagridData<T>>;
type DatagridCellMouseOutEvent<T> = CellMouseOutEvent<DatagridData<T>>;
type DatagridCellMouseDownEvent<T> = CellMouseDownEvent<DatagridData<T>>;

// Column Events
type DatagridColumnResizedEvent<T> = ColumnResizedEvent<DatagridData<T>>;
type DatagridColumnVisibleEvent<T> = ColumnVisibleEvent<DatagridData<T>>;
type DatagridColumnPinnedEvent<T> = ColumnPinnedEvent<DatagridData<T>>;
type DatagridColumnMovedEvent<T> = ColumnMovedEvent<DatagridData<T>>;
type DatagridColumnValueChangedEvent<T> = ColumnValueChangedEvent<DatagridData<T>>;
type DatagridColumnPivotChangedEvent<T> = ColumnPivotChangedEvent<DatagridData<T>>;
type DatagridColumnRowGroupChangedEvent<T> = ColumnRowGroupChangedEvent<DatagridData<T>>;
type DatagridColumnGroupOpenedEvent<T> = ColumnGroupOpenedEvent<DatagridData<T>>;
type DatagridColumnEverythingChangedEvent<T> = ColumnEverythingChangedEvent<DatagridData<T>>;
type DatagridNewColumnsLoadedEvent<T> = NewColumnsLoadedEvent<DatagridData<T>>;
type DatagridGridColumnsChangedEvent<T> = GridColumnsChangedEvent<DatagridData<T>>;
type DatagridVirtualColumnsChangedEvent<T> = VirtualColumnsChangedEvent<DatagridData<T>>;

// Filter Events
type DatagridFilterChangedEvent<T> = FilterChangedEvent<DatagridData<T>>;
type DatagridFilterModifiedEvent<T> = FilterModifiedEvent<DatagridData<T>>;
type DatagridFilterOpenedEvent<T> = FilterOpenedEvent<DatagridData<T>>;

// Sort Events
type DatagridSortChangedEvent<T> = SortChangedEvent<DatagridData<T>>;

// Selection Events
type DatagridSelectionChangedEvent<T> = SelectionChangedEvent<DatagridData<T>>;
type DatagridRangeSelectionChangedEvent<T> = RangeSelectionChangedEvent<DatagridData<T>>;

// Drag Events
type DatagridDragStartedEvent<T> = DragStartedEvent<DatagridData<T>>;
type DatagridDragStoppedEvent<T> = DragStoppedEvent<DatagridData<T>>;

// Pagination Events
type DatagridPaginationChangedEvent<T> = PaginationChangedEvent<DatagridData<T>>;

// Model Events
type DatagridModelUpdatedEvent<T> = ModelUpdatedEvent<DatagridData<T>>;

// Pinned Row Events
type DatagridPinnedRowDataChangedEvent<T> = PinnedRowDataChangedEvent<DatagridData<T>>;

// Paste Events
type DatagridPasteStartEvent<T> = PasteStartEvent<DatagridData<T>>;
type DatagridPasteEndEvent<T> = PasteEndEvent<DatagridData<T>>;

// Range Delete Events
type DatagridRangeDeleteStartEvent<T> = RangeDeleteStartEvent<DatagridData<T>>;
type DatagridRangeDeleteEndEvent<T> = RangeDeleteEndEvent<DatagridData<T>>;

// Viewport Events
type DatagridViewportChangedEvent<T> = ViewportChangedEvent<DatagridData<T>>;

// Tool Panel Events
type DatagridToolPanelVisibleChangedEvent<T> = ToolPanelVisibleChangedEvent<DatagridData<T>>;
