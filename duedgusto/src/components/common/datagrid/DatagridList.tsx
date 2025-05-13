/* eslint-disable @typescript-eslint/no-unused-vars */
import { ColDef } from "ag-grid-community";
import { useMemo } from "react";

interface DatagridListProps<T> {
  masterColDefs: ColDef<T>[];
}

function DatagridList<T>({
  masterColDefs,
}: DatagridListProps<T>) {
  // const fields = useMemo(() => masterColDefs.map(({ field }) => field?.split('.').reverse().reduce((acc, item, index, array) => (index + 1 === array.length ? `${item} ${acc}` : `{ ${item} ${acc} }`), '')), [masterColDefs]);
  return (
    <div>DatagridList</div>
  )
}

export default DatagridList