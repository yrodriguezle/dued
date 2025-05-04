import { GridApi, IRowNode } from "ag-grid-community";

interface IRowEvent<TData> {
  data: TData;
  node: IRowNode<TData>;
  api: GridApi<TData>;
  // column?: Column;
}
