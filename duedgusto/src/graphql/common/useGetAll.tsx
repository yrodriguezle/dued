import { FetchPolicy } from "@apollo/client";
import useQueryParams, { UseQueryParamsProps } from "./useQueryParams";
import { useState, useEffect } from "react";
import { useApolloClient } from "@apollo/client";

interface GetAllProps<T> extends Omit<UseQueryParamsProps<T>, "body" | "pageSize"> {
  fragmentBody: string[] | string;
  fetchPolicy?: FetchPolicy;
  skip?: boolean;
  pageSize?: number;
}

function useGetAll<T>(props: GetAllProps<T>) {
  const { query, variables } = useQueryParams<T>({
    queryName: props.queryName,
    fragment: props.fragment || "",
    where: props.where,
    orderBy: props.orderBy,
    pageSize: props.pageSize || 50,
    body: Array.isArray(props.fragmentBody) ? props.fragmentBody.join("\n") : props.fragmentBody,
  });

  const client = useApolloClient();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (props.skip) return;

    let isMounted = true;
    setLoading(true);

    const fetchAllData = async () => {
      try {
        let allData: T[] = [];
        let hasNextPage = true;
        let currentCursor = variables.cursor;

        while (hasNextPage) {
          const { data: queryData } = await client.query({
            query,
            variables: { ...variables, cursor: currentCursor },
            fetchPolicy: props.fetchPolicy || "cache-first",
          });

          const connection = queryData?.connection?.[props.queryName];

          if (connection) {
            allData = [...allData, ...connection.items];
            hasNextPage = connection.pageInfo.hasNextPage;
            currentCursor = connection.pageInfo.endCursor ? Number(connection.pageInfo.endCursor) : undefined;
          } else {
            hasNextPage = false;
          }
        }

        if (isMounted) {
          setData(allData);
        }
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [client, query, variables, props.skip, props.fetchPolicy, props.queryName]);

  return { data, loading, error };
}

export default useGetAll;
