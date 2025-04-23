import { useMemo } from "react";
import capitalize from "../../common/bones/capitalize";
import { gql, TypedDocumentNode } from "@apollo/client";

interface UseQueryParamsBase<T> {
  queryName: keyof RelayData<T>["connection"];
  where?: string;
  orderBy?: string;
  cursor?: number;
  pageSize: number;
}

interface UseQueryParamsArray<T> extends UseQueryParamsBase<T> {
  body: (keyof T)[];
  fragment?: never;
}

interface UseQueryParamsString<T> extends UseQueryParamsBase<T> {
  body: string;
  fragment: string;
}

export type UseQueryParamsProps<T> = UseQueryParamsArray<T> | UseQueryParamsString<T>;

function useQueryParams<T>(queryParams: UseQueryParamsProps<T>) {
  if (typeof queryParams.body === "string" && !queryParams.fragment) {
    throw new Error("Il parametro 'fragment' è obbligatorio quando body è una stringa.");
  }

  const query: TypedDocumentNode<RelayData<T>, RelayVariables> = useMemo(
    () =>
      gql(`${queryParams.fragment || ""}
      query Get${capitalize(queryParams.queryName as string)}By (
        $where: String,
        $pageSize: Int,
        $orderBy: String,
        $cursor: Int
      ) {
        connection {
          ${queryParams.queryName} (
            where: $where,
            first: $pageSize,
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
    `),
    [queryParams.body, queryParams.fragment, queryParams.queryName]
  );

  const variables: RelayVariables = useMemo(
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
