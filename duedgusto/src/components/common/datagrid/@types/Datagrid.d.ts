import { ColDef, GridApi, GridReadyEvent, IRowNode } from "ag-grid-community";
import { AgGridReactProps } from "ag-grid-react";
import { DatagridStatus } from "../../../../common/globals/constants";

interface DatagridAuxData {
  status: DatagridStatus;
}

type DatagridData<T extends Record<string, unknown>> = DatagridAuxData & T;

interface IRowEvent<TData> {
  data: TData;
  node: IRowNode<TData>;
  api: GridApi<TData>;
  // column?: Column;
}

interface BaseDatagridProps<T> extends AgGridReactProps<T> {
  height: string;
  // items: T[];
  onGridReady?: (event: GridReadyEvent<T>) => void;
  columnDefs: ColDef<T>[];
  addNewRowAt?: "top" | "bottom";
}
interface EditingModeProps<T> extends BaseDatagridProps<T> {
  presentation?: undefined;
  getNewRow: () => T;
  readOnly: boolean;
}
interface PresentationModeProps<T> extends BaseDatagridProps<T> {
  presentation: true;
  getNewRow?: never;
  readOnly?: never;
}
type DatagridProps<T> = EditingModeProps<T> | PresentationModeProps<T>;
