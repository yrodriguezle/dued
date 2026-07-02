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

export interface ValidationError {
  field: string;
  message: string;
}

export interface DatagridAuxData {
  status: DatagridStatus;
}

export type DatagridData<T extends object> = DatagridAuxData & T;

export interface IRowEvent<T extends object> {
  data?: DatagridData<T>;
  node: IRowNode<DatagridData<T>>;
  api: GridApi<DatagridData<T>>;
  column?: Column;
}

export type ValidateRow<T extends object> = (node: IRowNode<DatagridData<T>>) => Promise<{ id: string }>;

// Base AG-Grid types wrapped with DatagridData
export type DatagridAgGridProps<T extends object> = AgGridReactProps<DatagridData<T>>;
export type DatagridColDef<T extends object> = ColDef<DatagridData<T>>;
export type DatagridColGroupDef<T extends object> = ColGroupDef<DatagridData<T>>;

// Grid Events
export type DatagridGridReadyEvent<T extends object> = GridReadyEvent<DatagridData<T>>;
export type DatagridGridSizeChangedEvent<T extends object> = GridSizeChangedEvent<DatagridData<T>>;
export type DatagridFirstDataRenderedEvent<T extends object> = FirstDataRenderedEvent<DatagridData<T>>;

// Row Events
export type DatagridRowDataUpdatedEvent<T extends object> = RowDataUpdatedEvent<DatagridData<T>>;
export type DatagridRowClickedEvent<T extends object> = RowClickedEvent<DatagridData<T>>;
export type DatagridRowDoubleClickedEvent<T extends object> = RowDoubleClickedEvent<DatagridData<T>>;
export type DatagridRowSelectedEvent<T extends object> = RowSelectedEvent<DatagridData<T>>;
export type DatagridRowEditingStartedEvent<T extends object> = RowEditingStartedEvent<DatagridData<T>>;
export type DatagridRowEditingStoppedEvent<T extends object> = RowEditingStoppedEvent<DatagridData<T>>;
export type DatagridRowValueChangedEvent<T extends object> = RowValueChangedEvent<DatagridData<T>>;
export type DatagridRowGroupOpenedEvent<T extends object> = RowGroupOpenedEvent<DatagridData<T>>;
export type DatagridVirtualRowRemovedEvent<T extends object> = VirtualRowRemovedEvent<DatagridData<T>>;

// Row Drag Events
export type DatagridRowDragEndEvent<T extends object> = RowDragEndEvent<DatagridData<T>>;
export type DatagridRowDragEnterEvent<T extends object> = RowDragEnterEvent<DatagridData<T>>;
export type DatagridRowDragLeaveEvent<T extends object> = RowDragLeaveEvent<DatagridData<T>>;
export type DatagridRowDragMoveEvent<T extends object> = RowDragMoveEvent<DatagridData<T>>;

// Cell Events
export type DatagridCellClickedEvent<T extends object> = CellClickedEvent<DatagridData<T>>;
export type DatagridCellDoubleClickedEvent<T extends object> = CellDoubleClickedEvent<DatagridData<T>>;
export type DatagridCellContextMenuEvent<T extends object> = CellContextMenuEvent<DatagridData<T>>;
export type DatagridCellValueChangedEvent<T extends object> = CellValueChangedEvent<DatagridData<T>>;
export type DatagridCellEditingStartedEvent<T extends object> = CellEditingStartedEvent<DatagridData<T>>;
export type DatagridCellEditingStoppedEvent<T extends object> = CellEditingStoppedEvent<DatagridData<T>>;
export type DatagridCellFocusedEvent<T extends object> = CellFocusedEvent<DatagridData<T>>;
export type DatagridCellKeyDownEvent<T extends object> = CellKeyDownEvent<DatagridData<T>>;
export type DatagridCellMouseOverEvent<T extends object> = CellMouseOverEvent<DatagridData<T>>;
export type DatagridCellMouseOutEvent<T extends object> = CellMouseOutEvent<DatagridData<T>>;
export type DatagridCellMouseDownEvent<T extends object> = CellMouseDownEvent<DatagridData<T>>;

// Column Events
export type DatagridColumnResizedEvent<T extends object> = ColumnResizedEvent<DatagridData<T>>;
export type DatagridColumnVisibleEvent<T extends object> = ColumnVisibleEvent<DatagridData<T>>;
export type DatagridColumnPinnedEvent<T extends object> = ColumnPinnedEvent<DatagridData<T>>;
export type DatagridColumnMovedEvent<T extends object> = ColumnMovedEvent<DatagridData<T>>;
export type DatagridColumnValueChangedEvent<T extends object> = ColumnValueChangedEvent<DatagridData<T>>;
export type DatagridColumnPivotChangedEvent<T extends object> = ColumnPivotChangedEvent<DatagridData<T>>;
export type DatagridColumnRowGroupChangedEvent<T extends object> = ColumnRowGroupChangedEvent<DatagridData<T>>;
export type DatagridColumnGroupOpenedEvent<T extends object> = ColumnGroupOpenedEvent<DatagridData<T>>;
export type DatagridColumnEverythingChangedEvent<T extends object> = ColumnEverythingChangedEvent<DatagridData<T>>;
export type DatagridNewColumnsLoadedEvent<T extends object> = NewColumnsLoadedEvent<DatagridData<T>>;
export type DatagridGridColumnsChangedEvent<T extends object> = GridColumnsChangedEvent<DatagridData<T>>;
export type DatagridVirtualColumnsChangedEvent<T extends object> = VirtualColumnsChangedEvent<DatagridData<T>>;

// Filter Events
export type DatagridFilterChangedEvent<T extends object> = FilterChangedEvent<DatagridData<T>>;
export type DatagridFilterModifiedEvent<T extends object> = FilterModifiedEvent<DatagridData<T>>;
export type DatagridFilterOpenedEvent<T extends object> = FilterOpenedEvent<DatagridData<T>>;

// Sort Events
export type DatagridSortChangedEvent<T extends object> = SortChangedEvent<DatagridData<T>>;

// Selection Events
export type DatagridSelectionChangedEvent<T extends object> = SelectionChangedEvent<DatagridData<T>>;
export type DatagridRangeSelectionChangedEvent<T extends object> = RangeSelectionChangedEvent<DatagridData<T>>;

// Drag Events
export type DatagridDragStartedEvent<T extends object> = DragStartedEvent<DatagridData<T>>;
export type DatagridDragStoppedEvent<T extends object> = DragStoppedEvent<DatagridData<T>>;

// Pagination Events
export type DatagridPaginationChangedEvent<T extends object> = PaginationChangedEvent<DatagridData<T>>;

// Model Events
export type DatagridModelUpdatedEvent<T extends object> = ModelUpdatedEvent<DatagridData<T>>;

// Pinned Row Events
export type DatagridPinnedRowDataChangedEvent<T extends object> = PinnedRowDataChangedEvent<DatagridData<T>>;

// Paste Events
export type DatagridPasteStartEvent<T extends object> = PasteStartEvent<DatagridData<T>>;
export type DatagridPasteEndEvent<T extends object> = PasteEndEvent<DatagridData<T>>;

// Range Delete Events
export type DatagridRangeDeleteStartEvent<T extends object> = RangeDeleteStartEvent<DatagridData<T>>;
export type DatagridRangeDeleteEndEvent<T extends object> = RangeDeleteEndEvent<DatagridData<T>>;

// Viewport Events
export type DatagridViewportChangedEvent<T extends object> = ViewportChangedEvent<DatagridData<T>>;

// Tool Panel Events
export type DatagridToolPanelVisibleChangedEvent<T extends object> = ToolPanelVisibleChangedEvent<DatagridData<T>>;
