import { useCallback, useEffect, useRef, useState } from 'react';
import { useApolloClient, TypedDocumentNode, ObservableQuery, SubscriptionResult } from '@apollo/client';

interface UseFetchDataProps<T> {
  query: TypedDocumentNode<RelayData<T>, RelayVariables>
  variables: RelayVariables;
  skip?: boolean;
  resetData?: boolean;
  reverseGrid?: boolean;
  pageItems?: number;
  fetchPolicy?: 'cache-first' | 'network-only' | 'no-cache' | 'cache-only' | 'standby';
}

function useFetchData<T>({
  query,
  variables,
  skip,
  resetData,
  reverseGrid,
  pageItems = 100,
  fetchPolicy = 'network-only',
}: UseFetchDataProps<T>) {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [done, setDone] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [fetchedCount, setFetchedCount] = useState(0);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [items, setItems] = useState([]);
  const observer = useRef<SubscriptionResult<T, RelayVariables> | null>(null);
  const loadMoreObserver = useRef<SubscriptionResult<T, RelayVariables> | null>(null);
  const client = useApolloClient();

  const fetchItems = useCallback(
    async () => client.query({
      query,
      variables,
      fetchPolicy: 'cache-first',
    }),
    [client, query, variables],
  );

  useEffect(() => {
    if (resetData) {
      setItems([]);
    }
  }, [resetData]);

  useEffect(
    () => {
      const debounced = setTimeout(() => {
        if (query && variables && !skip) {
          setLoading(true);
          const observableQuery = client.watchQuery({
            query,
            variables,
            fetchPolicy,
          });
          observer.current = observableQuery
            .subscribe(
              ({ data: firstPage }) => {
                const nextPage = direction === 'first' ? 'hasNextPage' : 'hasPreviousPage';
                const hasMorePage = firstPage && firstPage[queryName]?.pageInfo[nextPage];
                const { items: firstPageItems } = (firstPage && firstPage[queryName]) || {};
                const firstItems = Array.isArray(firstPageItems) ? firstPageItems.slice() : [];
                const totalItems = firstPage && firstPage[queryName]?.totalCount;
                setTotalCount(totalItems);
                setHasMore(hasMorePage);
                setCursor(firstItems.length);
                const newItems = (reverseGrid ? firstItems.slice().reverse() : firstItems);
                setItems(newItems);
                setLoading(false);
                setDone(true);
                setFetchedCount(firstItems.length);
                observer.current = null;
              },
              () => {
                setLoading(false);
                setDone(true);
              },
            );
        } else if (query && variables && skip) {
          setDone(true);
        }
      }, 100);
      return () => clearTimeout(debounced);
    },
    [client, query, queryName, skip, variables, fetchPolicy, direction, reverseGrid],
  );


  return (
    <div>useFetchData</div>
  )
}

export default useFetchData