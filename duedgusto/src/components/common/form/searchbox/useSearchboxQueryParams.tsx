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
    const tokens = props.value ? props.value.toString().trim().split(" ").filter(Boolean) : [];
    const searchFields = props.options.searchFields?.length ? props.options.searchFields.map(String) : [String(props.fieldName)];

    // Ogni token deve matchare almeno uno dei campi (OR); i token sono in AND fra loro.
    const regularWhere = tokens
      .map((token) => {
        const orGroup = searchFields.map((field) => `${props.options.tableName}.${field} LIKE "%${token}%"`).join(" OR ");
        return searchFields.length > 1 ? `(${orGroup})` : orGroup;
      })
      .join(" AND ");

    const additionalWhere = props.options.additionalWhere || "";
    return [regularWhere, additionalWhere]
      .filter(Boolean)
      .map((statement, _, array) => (array.length > 1 ? `(${statement})` : statement))
      .join(" AND ");
  }, [props.fieldName, props.options.additionalWhere, props.options.searchFields, props.options.tableName, props.value]);

  return useQueryParams<T>({
    queryName: props.options.query,
    where,
    orderBy: props.orderBy,
    pageSize: props.pageSize || 10,
    body,
  });
}

export default useSearchboxQueryParams;
