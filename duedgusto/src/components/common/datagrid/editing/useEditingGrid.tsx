import { useCallback, useEffect } from "react";
import { CellEditingStartedEvent, CellValueChangedEvent, GridReadyEvent, IRowNode } from "ag-grid-community";
import { DatagridData } from "../@types/Datagrid";
import { DatagridStatus } from "../../../../common/globals/constants";

function useEditingGrid<T extends Record<string, unknown>>(
  ready: boolean,
  gridRef: React.RefObject<GridReadyEvent<DatagridData<T>> | null>,
  previousEditingNode: React.RefObject<IRowNode<DatagridData<T>> | null>
) {
  const handleCellEditingStarted = useCallback((params: CellEditingStartedEvent) => {
    params.api.deselectAll();
  }, []);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<DatagridData<T>>) => {
      if (event.column.getColId() === "status" || event.newValue === event.oldValue) {
        return;
      }
      const { data } = event.node;
      if (!data) {
        return;
      }
      data.status = DatagridStatus.Modified;
      previousEditingNode.current = event.node;
    },
    [previousEditingNode]
  );

  useEffect(() => {
    if (!ready || !gridRef.current) return;
    gridRef.current?.api.addEventListener("cellEditingStarted", handleCellEditingStarted);
    gridRef.current?.api.addEventListener("cellValueChanged", handleCellValueChanged);
  }, [gridRef, handleCellEditingStarted, handleCellValueChanged, ready]);

  return {
    handleCellEditingStarted,
    handleCellValueChanged,
  };
}

export default useEditingGrid;
