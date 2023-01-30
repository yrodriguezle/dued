import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useApolloClient, gql } from '@apollo/client';
import reverse from 'lodash/reverse';

const useFetchData = ({
  query,
  queryName,
  variables,
  skip,
  resetData,
  direction = 'first',
  reverseGrid,
  pageItems = 100,
  fetchPolicy = 'network-only',
}) => {
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [done, setDone] = useState(false);
  const [cursor, setCursor] = useState();
  const [totalCount, setTotalCount] = useState(0);
  const [fetchedCount, setFetchedCount] = useState(0);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [items, setItems] = useState([]);
  const observer = useRef();
  const loadMoreObserver = useRef();
  const client = useApolloClient();

  const fetchItems = useCallback(
    async () => client.query({
      query: gql`${query}`,
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

  useEffect(() => () => {
    if (observer?.current?.unsubscribe) {
      observer.current.unsubscribe();
    }
    if (loadMoreObserver?.current?.unsubscribe) {
      loadMoreObserver.current.unsubscribe();
    }
  }, []);

  useEffect(
    () => {
      if (observer?.current?.unsubscribe) {
        setLoading(false);
        observer.current.unsubscribe();
      }
      const debounced = setTimeout(() => {
        if (query && variables && !skip) {
          setLoading(true);
          const observableQuery = client.watchQuery({
            query: gql`${query}`,
            variables,
            fetchPolicy,
            skip,
          });
          observer.current = observableQuery
            .subscribe(
              ({ data: firstPage }) => {
                const nextPage = direction === 'first' ? 'hasNextPage' : 'hasPreviousPage';
                const hasMorePage = firstPage && firstPage[queryName]?.pageInfo[nextPage];
                const startOrEndCursor = direction === 'first' ? 'endCursor' : 'startCursor';
                const nextCursor = firstPage && firstPage[queryName]?.pageInfo[startOrEndCursor];
                const { items: firstPageItems } = (firstPage && firstPage[queryName]) || {};
                const firstItems = Array.isArray(firstPageItems) ? firstPageItems.slice() : [];
                const totalItems = firstPage && firstPage[queryName]?.totalCount;
                setTotalCount(totalItems);
                setHasMore(hasMorePage);
                setCursor(nextCursor);
                const newItems = (reverseGrid ? reverse(firstItems) : firstItems);
                setItems(newItems);
                setLoading(false);
                setDone(true);
                setFetchedCount(firstItems.length);
                observer.current.unsubscribe();
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

  const fetchMore = useCallback(
    () => {
      if (loadMoreObserver?.current?.unsubscribe) {
        loadMoreObserver.current.unsubscribe();
      }
      if (!loading && hasMore && !fetchingMore) {
        setFetchingMore(true);
        const observableQuery = client.watchQuery({
          query: gql`${query}`,
          variables: {
            ...variables,
            cursor,
          },
          fetchPolicy,
        });
        loadMoreObserver.current = observableQuery.subscribe(({ data: fetchMoreResult }) => {
          const newChunkItems = fetchMoreResult[queryName].items;
          const hasMorePage = fetchMoreResult && fetchMoreResult[queryName]?.pageInfo.hasNextPage;
          const endCursor = fetchMoreResult && fetchMoreResult[queryName]?.pageInfo.endCursor;
          const totalItems = fetchMoreResult && fetchMoreResult[queryName]?.totalCount;
          setHasMore(hasMorePage);
          setCursor(endCursor);
          setTotalCount(totalItems);
          setItems((prevItems) => [...prevItems, ...newChunkItems]);
          setFetchedCount((prev) => prev + newChunkItems.length);
          loadMoreObserver.current.unsubscribe();
          loadMoreObserver.current = null;
          setFetchingMore(false);
        });
      }
    },
    [loading, hasMore, fetchingMore, client, query, variables, cursor, fetchPolicy, queryName],
  );

  const loadMoreIntoGrid = useCallback(
    (params) => {
      // This function is called from searchbox without DATAGRID & Results modal with DATAGRID
      if (!loading && hasMore && !fetchingMore) {
        params.api.showLoadingOverlay();
        setFetchingMore(true);
        const previousItems = [];
        params.api.forEachLeafNode((node) => {
          previousItems.push(node.data);
        });
        const observableQuery = client.watchQuery({
          query: gql`${query}`,
          variables: {
            ...variables,
            cursor,
          },
          fetchPolicy: 'no-cache',
        });
        loadMoreObserver.current = observableQuery
          .subscribe(({ data: fetchMoreResult }) => {
            const newChunkItems = fetchMoreResult[queryName].items;
            if (newChunkItems.length) {
              if (reverseGrid) {
                const newReversedItems = [...reverse(newChunkItems.slice()), ...previousItems];
                params.api.setRowData(newReversedItems);
              } else {
                params.api.applyTransactionAsync({
                  add: newChunkItems,
                });
              }
              const reverseIndex = Math.min(pageItems, newChunkItems.length);
              const rowIndex = reverseGrid ? reverseIndex - 1 : previousItems.length - 1;
              const col = params.columnApi.getAllDisplayedColumns()
                .find(({ pinned }) => !pinned);
              const colId = col?.colId;
              params.api.ensureIndexVisible(rowIndex);
              params.api.setFocusedCell(rowIndex, colId);
              params.api.hideOverlay();
            }
            const nextPage = direction === 'first' ? 'hasNextPage' : 'hasPreviousPage';
            const hasMorePage = fetchMoreResult && fetchMoreResult[queryName]?.pageInfo[nextPage];
            const startOrEndCursor = direction === 'first' ? 'endCursor' : 'startCursor';
            const nextCursor = fetchMoreResult && fetchMoreResult[queryName]?.pageInfo[startOrEndCursor];
            setHasMore(hasMorePage);
            setCursor(nextCursor);
            setFetchedCount(previousItems.length + newChunkItems.length);
            if (loadMoreObserver?.current?.unsubscribe) {
              loadMoreObserver.current.unsubscribe();
              loadMoreObserver.current = null;
            }
            setFetchingMore(false);
          });
      }
    },
    [loading, hasMore, fetchingMore, client, query, variables, cursor, queryName, direction, reverseGrid, pageItems],
  );

  return {
    done,
    loading,
    items,
    hasMore,
    cursor,
    totalCount,
    fetchedCount,
    fetchMore,
    setHasMore,
    setCursor,
    fetchItems,
    loadMoreIntoGrid,
  };
};

export default useFetchData;
