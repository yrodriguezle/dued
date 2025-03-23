import {
  ApolloClient,
  ApolloLink,
  from,
  HttpLink,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { fromPromise } from "@apollo/client/link/utils";
import { getAuthHeaders } from "../common/authentication/auth";
import refreshToken from "./user/refreshToken";

interface ApolloClienContext {
  headers?: HeadersInit
}

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined;

// Flag per evitare chiamate multiple simultanee al refresh token
let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

const resolvePendingRequests = () => {
  pendingRequests.forEach(callback => callback());
  pendingRequests = [];
};

function configureClient() {
  if (apolloClient) {
    return apolloClient;
  }

  const httpLink = new HttpLink({
    uri: (window as Global).GRAPHQL_ENDPOINT,
  });

  const authLink = new ApolloLink((operation, forward) => {
    operation.setContext(({ headers }: ApolloClienContext) => {
      const authHeaders = getAuthHeaders();
      return {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json;charset=UTF-8",
          ...authHeaders,
          ...headers,
        },
      };
    });
    return forward(operation);
  });

  const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
    // Se riceviamo errori GraphQL relativi all'autenticazione...
    if (graphQLErrors && graphQLErrors.some(err => err.extensions?.code === "UNAUTHENTICATED")) {
      // Se un refresh è già in corso, aspettiamo che venga risolto
      if (!isRefreshing) {
        isRefreshing = true;
        refreshToken()
          .then(success => {
            if (success) {
              resolvePendingRequests();
            }
          })
          .catch(() => {
            // Gestisci eventuali errori nel refresh token (es. logout)
          })
          .finally(() => {
            isRefreshing = false;
          });
      }

      // Restituisci una promise che attende il completamento del refresh prima di ripetere la richiesta
      return fromPromise(
        new Promise(resolve => {
          pendingRequests.push(() => {
            // Aggiorna le intestazioni con il nuovo token
            const authHeaders = getAuthHeaders();
            operation.setContext(({ headers = {} }) => ({
              headers: {
                ...headers,
                ...authHeaders,
              },
            }));
            resolve(null);
          });
        })
      ).flatMap(() => forward(operation));
    }

    // Se networkError restituisce 401, possiamo applicare una logica simile
    if (networkError && "statusCode" in networkError && networkError.statusCode === 401) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshToken()
          .then(success => {
            if (success) {
              resolvePendingRequests();
            }
          })
          .catch(() => {
            // Gestisci errori nel refresh
          })
          .finally(() => {
            isRefreshing = false;
          });
      }
      return fromPromise(
        new Promise(resolve => {
          pendingRequests.push(() => {
            const authHeaders = getAuthHeaders();
            operation.setContext(({ headers = {} }) => ({
              headers: {
                ...headers,
                ...authHeaders,
              },
            }));
            resolve(null);
          });
        })
      ).flatMap(() => forward(operation));
    }
  });

  apolloClient = new ApolloClient({
    // link: from([
    //   authLink.concat(httpLink),
    // ]),
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache(),
  });
  return apolloClient;
}

export default configureClient;
