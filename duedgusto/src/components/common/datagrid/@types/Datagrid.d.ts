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
import { z } from "zod";
import { DatagridStatus } from "../../../../common/globals/constants";

export interface ValidationError {
  field: string;
  message: string;
}

export interface DatagridAuxData {
  status: DatagridStatus;
}

export type DatagridData<T extends Record<string, unknown>> = DatagridAuxData & T;

export interface IRowEvent<T extends Record<string, unknown>> {
  data?: DatagridData<T>;
  node: IRowNode<DatagridData<T>>;
  api: GridApi<DatagridData<T>>;
  column?: Column;
}

export interface BaseDatagridProps<T extends Record<string, unknown>> extends AgGridReactProps<T> {
  height: string;
  onGridReady?: (event: GridReadyEvent<DatagridData<T>>) => void;
  columnDefs: ColDef<DatagridData<T>>[];
  addNewRowAt?: "top" | "bottom";
  showRowNumbers?: boolean;
  hideToolbar?: boolean;
  validationSchema?: z.ZodSchema<T>;
  onValidationErrors?: (errors: Map<number, ValidationError[]>) => void;
}
export interface EditingModeProps<T extends Record<string, unknown>> extends BaseDatagridProps<T> {
  presentation?: undefined;
  getNewRow: () => T;
  readOnly: boolean;
}
export interface PresentationModeProps<T extends Record<string, unknown>> extends BaseDatagridProps<T> {
  presentation: true;
  getNewRow?: never;
  readOnly?: never;
}
export type DatagridProps<T extends Record<string, unknown>> = EditingModeProps<T> | PresentationModeProps<T>;

export type ValidateRow<T extends Record<string, unknown>> = (node: IRowNode<DatagridData<T>>) => Promise<{ id: string }>;

// Base AG-Grid types wrapped with DatagridData
export type DatagridAgGridProps<T> = AgGridReactProps<DatagridData<T>>;
export type DatagridColDef<T> = ColDef<DatagridData<T>>;
export type DatagridColGroupDef<T> = ColGroupDef<DatagridData<T>>;
export type DatagridIRowEvent<T> = IRowEvent<DatagridData<T>>;

// Grid Events
export type DatagridGridReadyEvent<T> = GridReadyEvent<DatagridData<T>>;
export type DatagridGridSizeChangedEvent<T> = GridSizeChangedEvent<DatagridData<T>>;
export type DatagridFirstDataRenderedEvent<T> = FirstDataRenderedEvent<DatagridData<T>>;

// Row Events
export type DatagridRowDataUpdatedEvent<T> = RowDataUpdatedEvent<DatagridData<T>>;
export type DatagridRowClickedEvent<T> = RowClickedEvent<DatagridData<T>>;
export type DatagridRowDoubleClickedEvent<T> = RowDoubleClickedEvent<DatagridData<T>>;
export type DatagridRowSelectedEvent<T> = RowSelectedEvent<DatagridData<T>>;
export type DatagridRowEditingStartedEvent<T> = RowEditingStartedEvent<DatagridData<T>>;
export type DatagridRowEditingStoppedEvent<T> = RowEditingStoppedEvent<DatagridData<T>>;
export type DatagridRowValueChangedEvent<T> = RowValueChangedEvent<DatagridData<T>>;
export type DatagridRowGroupOpenedEvent<T> = RowGroupOpenedEvent<DatagridData<T>>;
export type DatagridVirtualRowRemovedEvent<T> = VirtualRowRemovedEvent<DatagridData<T>>;

// Row Drag Events
export type DatagridRowDragEndEvent<T> = RowDragEndEvent<DatagridData<T>>;
export type DatagridRowDragEnterEvent<T> = RowDragEnterEvent<DatagridData<T>>;
export type DatagridRowDragLeaveEvent<T> = RowDragLeaveEvent<DatagridData<T>>;
export type DatagridRowDragMoveEvent<T> = RowDragMoveEvent<DatagridData<T>>;

// Cell Events
export type DatagridCellClickedEvent<T> = CellClickedEvent<DatagridData<T>>;
export type DatagridCellDoubleClickedEvent<T> = CellDoubleClickedEvent<DatagridData<T>>;
export type DatagridCellContextMenuEvent<T> = CellContextMenuEvent<DatagridData<T>>;
export type DatagridCellValueChangedEvent<T> = CellValueChangedEvent<DatagridData<T>>;
export type DatagridCellEditingStartedEvent<T> = CellEditingStartedEvent<DatagridData<T>>;
export type DatagridCellEditingStoppedEvent<T> = CellEditingStoppedEvent<DatagridData<T>>;
export type DatagridCellFocusedEvent<T> = CellFocusedEvent<DatagridData<T>>;
export type DatagridCellKeyDownEvent<T> = CellKeyDownEvent<DatagridData<T>>;
export type DatagridCellMouseOverEvent<T> = CellMouseOverEvent<DatagridData<T>>;
export type DatagridCellMouseOutEvent<T> = CellMouseOutEvent<DatagridData<T>>;
export type DatagridCellMouseDownEvent<T> = CellMouseDownEvent<DatagridData<T>>;

// Column Events
export type DatagridColumnResizedEvent<T> = ColumnResizedEvent<DatagridData<T>>;
export type DatagridColumnVisibleEvent<T> = ColumnVisibleEvent<DatagridData<T>>;
export type DatagridColumnPinnedEvent<T> = ColumnPinnedEvent<DatagridData<T>>;
export type DatagridColumnMovedEvent<T> = ColumnMovedEvent<DatagridData<T>>;
export type DatagridColumnValueChangedEvent<T> = ColumnValueChangedEvent<DatagridData<T>>;
export type DatagridColumnPivotChangedEvent<T> = ColumnPivotChangedEvent<DatagridData<T>>;
export type DatagridColumnRowGroupChangedEvent<T> = ColumnRowGroupChangedEvent<DatagridData<T>>;
export type DatagridColumnGroupOpenedEvent<T> = ColumnGroupOpenedEvent<DatagridData<T>>;
export type DatagridColumnEverythingChangedEvent<T> = ColumnEverythingChangedEvent<DatagridData<T>>;
export type DatagridNewColumnsLoadedEvent<T> = NewColumnsLoadedEvent<DatagridData<T>>;
export type DatagridGridColumnsChangedEvent<T> = GridColumnsChangedEvent<DatagridData<T>>;
export type DatagridVirtualColumnsChangedEvent<T> = VirtualColumnsChangedEvent<DatagridData<T>>;

// Filter Events
export type DatagridFilterChangedEvent<T> = FilterChangedEvent<DatagridData<T>>;
export type DatagridFilterModifiedEvent<T> = FilterModifiedEvent<DatagridData<T>>;
export type DatagridFilterOpenedEvent<T> = FilterOpenedEvent<DatagridData<T>>;

// Sort Events
export type DatagridSortChangedEvent<T> = SortChangedEvent<DatagridData<T>>;

// Selection Events
export type DatagridSelectionChangedEvent<T> = SelectionChangedEvent<DatagridData<T>>;
export type DatagridRangeSelectionChangedEvent<T> = RangeSelectionChangedEvent<DatagridData<T>>;

// Drag Events
export type DatagridDragStartedEvent<T> = DragStartedEvent<DatagridData<T>>;
export type DatagridDragStoppedEvent<T> = DragStoppedEvent<DatagridData<T>>;

// Pagination Events
export type DatagridPaginationChangedEvent<T> = PaginationChangedEvent<DatagridData<T>>;

// Model Events
export type DatagridModelUpdatedEvent<T> = ModelUpdatedEvent<DatagridData<T>>;

// Pinned Row Events
export type DatagridPinnedRowDataChangedEvent<T> = PinnedRowDataChangedEvent<DatagridData<T>>;

// Paste Events
export type DatagridPasteStartEvent<T> = PasteStartEvent<DatagridData<T>>;
export type DatagridPasteEndEvent<T> = PasteEndEvent<DatagridData<T>>;

// Range Delete Events
export type DatagridRangeDeleteStartEvent<T> = RangeDeleteStartEvent<DatagridData<T>>;
export type DatagridRangeDeleteEndEvent<T> = RangeDeleteEndEvent<DatagridData<T>>;

// Viewport Events
export type DatagridViewportChangedEvent<T> = ViewportChangedEvent<DatagridData<T>>;

// Tool Panel Events
export type DatagridToolPanelVisibleChangedEvent<T> = ToolPanelVisibleChangedEvent<DatagridData<T>>;
