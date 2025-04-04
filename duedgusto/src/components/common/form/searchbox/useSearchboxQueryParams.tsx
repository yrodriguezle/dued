import { useMemo } from "react";
import { DatagridColDef, SearchboxOptions } from "../../../../@types/searchbox";
import useQueryParams from "../../../../graphql/common/useQueryParams";

interface UseSearchboxQueryParamsProps<T> {
  options: SearchboxOptions<T>;
  orderBy?: string;
  value: string;
  fieldName: string;
  modal?: boolean;
  pageSize?: number;
}

function useSearchboxQueryParams<T>(props: UseSearchboxQueryParamsProps<T>) {
  const body = useMemo(() => {
    if (props.modal) {
      const modalFields = props.options.modal.items.map((item) => item.field);
      return modalFields;
    }
    const fields = props.options.items.map((item) => item.field) as DatagridColDef<T>[];
    return fields;
  }, [props.modal, props.options.items, props.options.modal.items]);

  const where = useMemo(() => {
    const values = (props.value ? props.value.toString().trim().split(" ") : []).map((value) => `"%${value}%"`);
    const lookupFieldName = `[${props.options.tableName}].${props.fieldName}`;
    const regularWhere = values.length ? `${lookupFieldName} LIKE ${values.join(` AND ${lookupFieldName} LIKE `)}` : "";

    const additionalWhere = props.options.additionalWhere || "";
    return [regularWhere, additionalWhere]
      .filter(Boolean)
      .map((statement, _, array) => (array.length > 1 ? `(${statement})` : statement))
      .join(" OR ");
  }, [props.fieldName, props.options.additionalWhere, props.options.tableName, props.value]);

  return useQueryParams<T>({
    queryName: props.options.query,
    where,
    orderBy: props.orderBy,
    pageSize: props.pageSize || 10,
    body: body as (keyof T)[],
  });
}

export default useSearchboxQueryParams;
