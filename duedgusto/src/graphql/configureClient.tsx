import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, NormalizedCacheObject, from, split } from "@apollo/client";
import { WebSocketLink } from '@apollo/client/link/ws';
import { Observable, getMainDefinition } from "@apollo/client/utilities";
import { SubscriptionClient } from "subscriptions-transport-ws";
import { setContext } from '@apollo/client/link/context';
import { ErrorResponse, onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

import { getAuthHeaders } from "../common/authentication/auth";
import refreshToken from "../api/authentication/refreshToken";
import logger from "../common/logger/logger";
import showToast from "../common/toast/showToast";
import omitDeep from "../common/bones/omitDeep";

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined;

function configureClient() {
  if (apolloClient) {
    return apolloClient;
  }

  const httpLink = new HttpLink({ uri: (window as Global).GRAPHQL_ENDPOINT });
  const wsLink = new WebSocketLink(new SubscriptionClient((window as Global).GRAPHQL_WEBSOCKET || '', { reconnect: true }));
  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === 'OperationDefinition'
        && definition.operation === 'subscription'
      );
    },
    wsLink,
    httpLink,
  );
  const authLink = setContext((_, { headers }) => {
    const authHeaders = getAuthHeaders();
    return {
      headers: {
        ...headers,
        Accept: 'application/json',
        'Content-Type': 'application/json;charset=UTF-8',
        ...authHeaders,
      },
    };
  });

  const errorLink = onError((props: ErrorResponse) => {
    // Refresh token when expired
    if (Array.isArray(props.graphQLErrors) && props.graphQLErrors.some(({ extensions }) => extensions.number === 'authentication-required')) {
      return new Observable((observer) => {
        refreshToken()
          .then((refreshed: boolean) => {
            if (refreshed) {
              const oldHeaders = props.operation.getContext().headers;
              const authHeaders = getAuthHeaders();
              props.operation.setContext({
                headers: {
                  ...oldHeaders,
                  ...authHeaders,
                },
              });
            } else {
              window.location.reload();
            }
          })
          .then(() => {
            const subscriber = {
              next: observer.next.bind(observer),
              error: observer.error.bind(observer),
              complete: observer.complete.bind(observer),
            };
            // Retry last failed request
            props.forward(props.operation).subscribe(subscriber);
          })
          .catch((error: unknown) => {
            // No refresh or client token available, we force user to login
            observer.error(error);
          });
      });
    }

    if (props.graphQLErrors?.length)
    {
      props.graphQLErrors.forEach(({ message, locations, path }) => {
        logger.log(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`);
        logger.log('[Props]:', props);
      });
      // const definition = getMainDefinition(props.operation.query);
      // if (definition.kind === 'OperationDefinition' && definition.operation === 'mutation' && apolloClient) {
      //   const store = useStore.getState();
      //   const { viewName } = store.pendingWork;
      //   store.receiveGraphqlMessage({
      //     id: viewName,
      //     message: sanitizeGraphQLErrorMessage(props.graphQLErrors[0].message) || appMessages.error.mutation,
      //     operationType: props.operation.operationName.startsWith("AddOrUpdate") ? mutationType.AddOrUpdate : mutationType.Delete,
      //     action: async () => apolloClient?.mutate({
      //       mutation: props.operation.query,
      //       variables: props.operation.variables,
      //     }),
      //   });
      // }
    }
    if (props.networkError) {
      logger.log(`[Network error]: ${props.networkError}`);
      logger.log('[Props]:', props);
      showToast({
        type: 'error',
        position: 'bottom-right',
        message: 'error', // appMessages.error.networkError,
        autoClose: false,
        toastId: 'network-error',
      });
    }
    // Complete the observable without propagating errors to UI
    return Observable.of();
  });
  const retryLink = new RetryLink({
    delay: {
      initial: 2000,
      max: Infinity,
    },
    attempts: {
      max: 5,
      retryIf: (error) => !!error, //  && import.meta.env.PROD,
    },
  });
  const omitPropsLink = new ApolloLink((operation, forward) => {
    const { query } = operation;
    const definition = getMainDefinition(query);
    if (definition.kind === 'OperationDefinition' && definition.operation === 'mutation') {
      operation.variables = omitDeep(operation.variables, ['__typename', 'keys']);
    }
    return forward(operation).map((operationData) => operationData);
  });
  const client = new ApolloClient({
    cache: new InMemoryCache({}),
    link: from([
      omitPropsLink,
      retryLink,
      errorLink,
      authLink.concat(splitLink),
    ]),
    queryDeduplication: true,
  });

  apolloClient = client;
  return client;
}

export default configureClient;
