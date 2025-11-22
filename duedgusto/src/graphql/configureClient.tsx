import { ApolloClient, ApolloLink, from, HttpLink, InMemoryCache, NormalizedCacheObject } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { fromPromise } from "@apollo/client/link/utils";
import { getAuthHeaders } from "../common/authentication/auth";
import { getCsrfTokenFromCookie } from "../common/authentication/csrfToken";
import refreshToken from "../api/refreshToken";
import onRefreshFails from "../common/authentication/onRefreshFails";

interface ApolloClienContext {
  headers?: HeadersInit;
}

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined;

// Flag per evitare chiamate multiple simultanee al refresh token
let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

const resolvePendingRequests = () => {
  pendingRequests.forEach((callback) => callback());
  pendingRequests = [];
};

function configureClient() {
  if (apolloClient) {
    return apolloClient;
  }

  const httpLink = new HttpLink({
    uri: (window as Global).GRAPHQL_ENDPOINT,
    credentials: "include", // Include httpOnly cookies in GraphQL requests
  });

  const authLink = new ApolloLink((operation, forward) => {
    operation.setContext(({ headers }: ApolloClienContext) => {
      const authHeaders = getAuthHeaders();

      // Check if this is a mutation (state-changing operation)
      const isMutation = operation.query.definitions.some(
        (def) =>
          def.kind === "OperationDefinition" &&
          def.operation === "mutation"
      );

      // Add CSRF token to mutations for CSRF protection
      const csrfToken = isMutation ? getCsrfTokenFromCookie() : null;
      return {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json;charset=UTF-8",
          ...authHeaders,
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          ...headers,
        },
      };
    });
    return forward(operation);
  });

  const errorLink = onError(({ graphQLErrors, operation, forward }) => {
    if (graphQLErrors && graphQLErrors.some((err) => err.extensions?.code === "ACCESS_DENIED")) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshToken()
          .then((success) => {
            if (success) {
              resolvePendingRequests();
            }
          })
          .catch(() => {
            onRefreshFails();
          })
          .finally(() => {
            isRefreshing = false;
          });
      }

      // Restituisci una promise che attende il completamento del refresh prima di ripetere la richiesta
      return fromPromise(
        new Promise((resolve) => {
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
  });

  apolloClient = new ApolloClient({
    link: from([errorLink, authLink, httpLink]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            connection: {
              // Indica ad Apollo di ignorare gli argomenti per questo campo, oppure
              // se preferisci, specifica quali argomenti utilizzabili per differenziare i campi
              keyArgs: false,
              merge(existing = {}, incoming) {
                // Logica di merge: unisci gli oggetti esistenti e quelli in arrivo.
                // Questo esempio esegue una fusione superficiale; adatta la logica
                // in base alla struttura dei tuoi dati
                return { ...existing, ...incoming };
              },
            },
            cashManagement: {
              // Merge function for cashManagement field to avoid cache loss warnings
              // This field doesn't have a stable ID, so we use keyArgs: false to merge
              // all requests into a single cache entry
              keyArgs: false,
              merge(existing = {}, incoming) {
                // Deep merge of existing and incoming data
                // Preserve denominations if incoming doesn't have them
                return {
                  ...existing,
                  ...incoming,
                };
              },
            },
          },
        },
      },
    }),
  });
  return apolloClient;
}

export default configureClient;
