import { CellEditingStartedEvent } from "ag-grid-community";
import { useCallback } from "react";
import { DatagridData, IRowEvent, ValidateRow } from "../@types/Datagrid";
import { DatagridStatus } from "../../../../common/globals/constants";
import showToast from "../../../../common/toast/showToast";
import reportError from "../../../../common/bones/reportError";
import hideToast from "../../../../common/toast/hideToast";
import getFirstEditableColumn from "../getFirstEditableColumn";

function useGridValidation<T extends Record<string, unknown>>() {
  const validateRow = useCallback(async (event: CellEditingStartedEvent<DatagridData<T>>, validationOnly: boolean = false) => {
    if (!event?.node) {
      throw new Error("node not exists");
    }
    const { node } = event;
    if (node.data?.status === DatagridStatus.Valid) {
      return true;
    }
    if (event.context.props?.onValidateRow || node.data?.status === DatagridStatus.Unchanged) {
      node.setDataValue("status", DatagridStatus.Valid);
      return true;
    }
    try {
      event.api.setGridOption("loading", true);
      const onValidateRow: ValidateRow<T> = event.context.props.onValidateRow;
      return onValidateRow(node)
        .then(({ id }) => {
          hideToast(id);
          node.setDataValue("status", DatagridStatus.Valid);
          return true;
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "{}";
          const jsonMessage: { id: string; colId: string; message: string } = JSON.parse(message);

          showToast({
            type: "error",
            position: "bottom-right",
            message: jsonMessage.message,
            toastId: jsonMessage.id,
          });
          node.setDataValue("status", DatagridStatus.Invalid);

          if (!validationOnly) {
            const rowEvent: IRowEvent<DatagridData<T>> = {
              data: node.data,
              node,
              api: event.api,
              column: event.column,
            };
            const firstEditableColumn = getFirstEditableColumn(rowEvent);
            if (firstEditableColumn && event.context.gotoEditCell) {
              event.context.gotoEditCell(node.rowIndex ?? 0, firstEditableColumn);
            }
          }
        });
    } catch (error) {
      showToast({
        type: "error",
        position: "bottom-right",
        message: reportError(error) || "Error in Datagrid - validateRow",
        toastId: "error",
      });
    } finally {
      if (!event.api.isDestroyed()) {
        event.api.setGridOption("loading", false);
      }
    }
  }, []);

  const validatePreviousEditedRow = useCallback(
    async (event: CellEditingStartedEvent<DatagridData<T>>, validationOnly: boolean = false) => {
      const previousEditingNode: CellEditingStartedEvent<DatagridData<T>> | null = event.context.previousEditingNode.current;
      if (!previousEditingNode || previousEditingNode.rowIndex === event.rowIndex) {
        return true;
      }
      if (previousEditingNode.data?.status === DatagridStatus.Added) {
        event.api.applyTransaction({ remove: [previousEditingNode.data] });
        event.context.previousEditingNode.current = null;
        return true;
      }
      if (previousEditingNode.node?.displayed === false) {
        event.context.previousEditingNode.current = null;
        return true;
      }
      return validateRow(event, validationOnly);
    },
    [validateRow]
  );

  return {
    validateRow,
    validatePreviousEditedRow,
  };
}

export default useGridValidation;
