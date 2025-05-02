import { useCallback, useEffect, useRef, useState } from "react";
import { useApolloClient, TypedDocumentNode, ObservableSubscription, WatchQueryFetchPolicy } from "@apollo/client";
import getQueryName from "./getQueryName";
import logger from "../../common/logger/logger";

interface UseFetchDataProps<T> {
  query: TypedDocumentNode<RelayData<T>, RelayVariables>;
  variables: RelayVariables;
  skip?: boolean;
  resetData?: boolean;
  reverseGrid?: boolean;
  pageItems?: number;
  fetchPolicy?: WatchQueryFetchPolicy;
}

interface RelayResult<T> {
  totalCount: number;
  hasMore: boolean;
  items: T[];
  cursor: number;
}

function useFetchData<T>({
  query,
  variables,
  skip,
  reverseGrid,
  fetchPolicy = "network-only",
}: UseFetchDataProps<T>) {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [items, setItems] = useState<T[]>([]);
  const requestId = useRef(0);
  const firstPageSubscription = useRef<ObservableSubscription>(null);
  const loadMoreSubscription = useRef<ObservableSubscription>(null);
  const client = useApolloClient();

  const fetchItems = useCallback(
    async () =>
      client.query({
        query,
        variables,
        fetchPolicy: "cache-first",
      }),
    [client, query, variables]
  );

  useEffect(() => () => {
    if (firstPageSubscription?.current?.unsubscribe) {
      firstPageSubscription.current.unsubscribe();
    }
    if (loadMoreSubscription?.current?.unsubscribe) {
      loadMoreSubscription.current.unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (firstPageSubscription?.current?.unsubscribe) {
      setLoading(false);
      firstPageSubscription.current.unsubscribe();
    }
    const debouncedFetch = setTimeout(() => {
      if (skip || !query || !variables) {
        return;
      }
      const thisRequest = ++requestId.current;
      setLoading(true);
      const observable = client.watchQuery({ query, variables, fetchPolicy });
      firstPageSubscription.current = observable.subscribe({
        next: ({ data: firstPage }) => {
          if (thisRequest !== requestId.current) return;
          const nextPage = reverseGrid ? "hasPreviousPage" : "hasNextPage";
          const queryName = getQueryName(query);
          const totalCount = firstPage && firstPage.connection[queryName]?.totalCount;
          const hasMore = firstPage?.connection[queryName]?.pageInfo[nextPage];
          const { items = [] } = (firstPage && firstPage.connection[queryName]) || {};
          const newItems = reverseGrid ? items.slice().reverse() : items;
          setTotalCount(totalCount);
          setHasMore(hasMore);
          setItems(newItems);
          setCursor(newItems.length);
          setLoading(false);
        },
        error: (err) => {
          if (thisRequest !== requestId.current) return;
          setLoading(false);
          const errorMessage = err.message || "Error fetching data";
          logger.log(errorMessage);
          setTotalCount(0);
          setHasMore(false);
          setItems([]);
          setCursor(0);
        },
      });
    }, 300);

    return () => clearTimeout(debouncedFetch);
  }, [skip, query, variables, client, fetchPolicy, reverseGrid]);

  const subscribeToMore = useCallback(
    (): Promise<RelayResult<T>> =>
      new Promise((resolve) => {
        if (loadMoreSubscription.current?.unsubscribe) {
          loadMoreSubscription.current.unsubscribe();
        }
        if (loading && !hasMore && fetchingMore) {
          return;
        }
        setFetchingMore(true);
        const observable = client.watchQuery({
          query,
          variables: {
            ...variables,
            after: cursor,
          },
          fetchPolicy,
        });
        loadMoreSubscription.current = observable.subscribe({
          next: ({ data: nextPage }) => {
            const nextPageInfo = reverseGrid ? "hasPreviousPage" : "hasNextPage";
            const queryName = getQueryName(query);
            const totalCount = nextPage && nextPage.connection[queryName]?.totalCount;
            const hasMore = nextPage?.connection[queryName]?.pageInfo[nextPageInfo];
            const { items = [] } = (nextPage && nextPage.connection[queryName]) || {};
            const newItems = reverseGrid ? items.slice().reverse() : items;
            setItems((prevItems) => [...prevItems, ...newItems]);
            setTotalCount(totalCount);
            setHasMore(hasMore);
            let newCursor = 0;
            setCursor((prevCursor) => {
              newCursor = prevCursor + newItems.length;
              return newCursor;
            });
            resolve({
              totalCount,
              hasMore,
              items: newItems,
              cursor: newCursor,
            });
          },
          error: (err) => {
            setFetchingMore(false);
            const errorMessage = err.message || "Error fetching data";
            logger.log(errorMessage);
            resolve({
              totalCount: 0,
              hasMore: false,
              items: [],
              cursor: 0,
            });
          },
        });
      }),
    [client, cursor, fetchPolicy, fetchingMore, hasMore, loading, query, reverseGrid, variables]
  );

  return {
    hasMore,
    totalCount,
    items,
    cursor,
    fetchItems,
    subscribeToMore,
    loading,
  };
}

export default useFetchData;
