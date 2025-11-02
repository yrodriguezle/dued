import { ColDef, Column, GridApi, GridReadyEvent, IRowNode } from "ag-grid-community";
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

type DatagridAgGridProps<T> = AgGridReactProps<DatagridData<T>>;
type DatagridColDef<T> = ColDef<DatagridData<T>>;
type DatagridColGroupDef<T> = ColGroupDef<DatagridData<T>>;
type DatagridIRowEvent<T> = IRowEvent<DatagridData<T>>;
type DatagridRowDataUpdatedEvent<T> = RowDataUpdatedEvent<DatagridData<T>>;
type DatagridCellValueChangedEvent<T> = CellValueChangedEvent<DatagridData<T>>;
