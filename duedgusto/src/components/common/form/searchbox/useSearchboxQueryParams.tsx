import { useMemo } from "react";
import { SearchboxOptions } from "../../../../@types/searchbox";
import useQueryParams from "../../../../graphql/common/useQueryParams";

interface UseSearchboxQueryParamsProps<T extends object, K extends keyof T> {
  options: SearchboxOptions<T>;
  orderBy?: string;
  value: string;
  fieldName: K;
  modal?: boolean;
  pageSize?: number;
}

function useSearchboxQueryParams<T extends object, K extends keyof T>(props: UseSearchboxQueryParamsProps<T, K>) {
  const body = useMemo(() => {
    const sourceItems = props.modal ? props.options.modal.items : props.options.items;
    // I `field` delle colonne searchbox sono i nomi dei campi GraphQL da richiedere.
    // Cast documentato: ColDefField<T> ammette anche path annidati ("a.b"), mentre il contratto
    // di useQueryParams richiede (keyof T)[]; le searchboxOptions usano solo campi di primo livello.
    const fieldNames = sourceItems.map((item): string | undefined => item.field).filter((f): f is string => typeof f === "string");
    return fieldNames as Extract<keyof T, string>[];
  }, [props.modal, props.options.items, props.options.modal.items]);

  const where = useMemo(() => {
    const values = (props.value ? props.value.toString().trim().split(" ").filter(Boolean) : []).map((value) => `"%${value}%"`);
    const lookupFieldName = `${props.options.tableName}.${String(props.fieldName)}`;
    const regularWhere = values.length ? `${lookupFieldName} LIKE ${values.join(` AND ${lookupFieldName} LIKE `)}` : "";

    const additionalWhere = props.options.additionalWhere || "";
    return [regularWhere, additionalWhere]
      .filter(Boolean)
      .map((statement, _, array) => (array.length > 1 ? `(${statement})` : statement))
      .join(" AND ");
  }, [props.fieldName, props.options.additionalWhere, props.options.tableName, props.value]);

  return useQueryParams<T>({
    queryName: props.options.query,
    where,
    orderBy: props.orderBy,
    pageSize: props.pageSize || 10,
    body,
  });
}

export default useSearchboxQueryParams;
