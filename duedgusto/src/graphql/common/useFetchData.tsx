import { useCallback, useEffect, useRef } from "react";
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

function useFetchData<T>({
  query,
  variables,
  // skip,
  // resetData,
  reverseGrid,
  // pageItems = 100,
  fetchPolicy = "network-only",
}: UseFetchDataProps<T>) {
  // const [loading, setLoading] = useState(false);
  // const [hasMore, setHasMore] = useState(false);
  // const [done, setDone] = useState(false);
  // const [cursor, setCursor] = useState(0);
  // const [totalCount, setTotalCount] = useState(0);
  // const [fetchedCount, setFetchedCount] = useState(0);
  // const [fetchingMore, setFetchingMore] = useState(false);
  // const [items, setItems] = useState([]);
  const subscription = useRef<ObservableSubscription>(null);
  // const loadMoreSubscription = useRef<ObservableSubscription>(null);
  const client = useApolloClient();

  // const fetchItems = useCallback(
  //   async () => client.query({
  //     query,
  //     variables,
  //     fetchPolicy: 'cache-first',
  //   }),
  //   [client, query, variables],
  // );

  // useEffect(() => {
  //   if (resetData) {
  //     setItems([]);
  //   }
  // }, [resetData]);

  const subscribeFirstPage = useCallback(
    () =>
      new Promise((resolve) => {
        if (subscription.current?.unsubscribe) {
          subscription.current.unsubscribe();
        }
        const observable = client.watchQuery({ query, variables, fetchPolicy });
        subscription.current = observable.subscribe({
          next: ({ data: firstPage }) => {
            const nextPage = reverseGrid ? "hasPreviousPage" : "hasNextPage";
            const queryName = getQueryName(query);
            const totalCount = firstPage && firstPage.management[queryName]?.totalCount;
            const hasMore = firstPage?.management[queryName]?.pageInfo[nextPage];
            const { items = [] } = (firstPage && firstPage.management[queryName]) || {};
            const newItems = reverseGrid ? items.slice().reverse() : items;
            resolve({
              totalCount,
              hasMore,
              items: newItems,
              cursor: newItems.length,
            });
          },
          error: (err) => {
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
    [client, fetchPolicy, query, reverseGrid, variables]
  );

  useEffect(() => {
    async function fetchData() {
      const result = await subscribeFirstPage();
      logger.log(result);
    }
    fetchData();
  }, [subscribeFirstPage]);
}

export default useFetchData;
