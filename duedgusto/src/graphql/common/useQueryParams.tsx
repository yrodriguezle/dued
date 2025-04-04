import { useMemo } from "react";
import capitalize from "../../common/bones/capitalize";

interface UseQueryParamsBase {
  queryName: string;
  where?: string;
  orderBy?: string;
  cursor?: number;
  pageSize: number;
}

// Caso in cui body è un array di chiavi di T (es. keyof T)
interface UseQueryParamsArray<T> extends UseQueryParamsBase {
  body: (keyof T)[];
  fragment?: never;
}

// Caso in cui body è una stringa, e quindi deve essere specificato fragment
interface UseQueryParamsString extends UseQueryParamsBase {
  body: string;
  fragment: string;
}

type UseQueryParamsProps<T> = UseQueryParamsArray<T> | UseQueryParamsString;

function useQueryParams<T>(queryParams: UseQueryParamsProps<T>) {
  // Se body è una stringa, è obbligatorio che fragment sia presente
  if (typeof queryParams.body === "string" && !queryParams.fragment) {
    throw new Error("Il parametro 'fragment' è obbligatorio quando body è una stringa.");
  }

  const query = useMemo(
    () => `${queryParams.fragment || ""}
      query Get${capitalize(queryParams.queryName)}By (
        $where: String,
        $pageSize: Int,
        $orderBy: String,
        $cursor: Int
      ) {
        management {
          ${queryParams.queryName} (
            where: $where,
            pageSize: $pageSize,
            orderBy: $orderBy,
            cursor: $cursor,
          ) {
            totalCount
            pageInfo {
              hasNextPage   
              endCursor
              hasPreviousPage
              startCursor
            }
            items {
              ${Array.isArray(queryParams.body) ? queryParams.body.join("\n") : queryParams.body}
            }
          }
        }
      }
    `,
    [queryParams.body, queryParams.fragment, queryParams.queryName]
  );

  const variables = useMemo(
    () => ({
      pageSize: queryParams.pageSize,
      where: (queryParams.where || "").replace(/\n/g, " ").replace(/\s\s+/g, " ").trim(),
      orderBy: queryParams.orderBy,
      cursor: queryParams.cursor ?? 0,
    }),
    [queryParams.cursor, queryParams.orderBy, queryParams.pageSize, queryParams.where]
  );

  return {
    query,
    variables,
  };
}

export default useQueryParams;
