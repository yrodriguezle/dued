import { useCallback } from "react";
import { z } from "zod";
import { GridApi, IRowNode } from "ag-grid-community";
import { DatagridData } from "../@types/Datagrid";
import { DatagridStatus } from "../../../../common/globals/constants";

export interface ValidationError {
  field: string;
  message: string;
}

interface UseZodValidationProps<T extends Record<string, unknown>> {
  schema?: z.ZodSchema<T>;
}

interface UseZodValidationReturn<T extends Record<string, unknown>> {
  validateRow: (node: IRowNode<DatagridData<T>>) => ValidationError[] | null;
  validateAllRows: (api: GridApi<DatagridData<T>>) => Map<number, ValidationError[]>;
}

function useZodValidation<T extends Record<string, unknown>>(props: UseZodValidationProps<T>): UseZodValidationReturn<T> {
  const { schema } = props;

  const validateRow = useCallback(
    (node: IRowNode<DatagridData<T>>): ValidationError[] | null => {
      if (!schema || !node.data) {
        return null;
      }

      // Escludi i campi ausiliari (status, etc.)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { status, ...rowData } = node.data;

      try {
        schema.parse(rowData);

        // Validazione superata - marca come valido solo se non è in editing
        if (node.data.status !== DatagridStatus.Editing) {
          node.setDataValue("status", DatagridStatus.Valid);
        }

        return null;
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Marca come invalido
          node.setDataValue("status", DatagridStatus.Invalid);

          // Converti gli errori Zod nel nostro formato
          const errors: ValidationError[] = error.errors.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          }));

          return errors;
        }
        return null;
      }
    },
    [schema]
  );

  const validateAllRows = useCallback(
    (api: GridApi<DatagridData<T>>): Map<number, ValidationError[]> => {
      const errorMap = new Map<number, ValidationError[]>();

      if (!schema) {
        return errorMap;
      }

      api.forEachNode((node: IRowNode<DatagridData<T>>) => {
        const errors = validateRow(node);
        if (errors && errors.length > 0) {
          errorMap.set(node.rowIndex ?? 0, errors);
        }
      });

      return errorMap;
    },
    [schema, validateRow]
  );

  return {
    validateRow,
    validateAllRows,
  };
}

export default useZodValidation;
