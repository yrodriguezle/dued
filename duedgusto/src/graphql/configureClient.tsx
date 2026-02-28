import { ApolloClient, ApolloLink, from, HttpLink, InMemoryCache, NormalizedCacheObject } from "@apollo/client";
import { onError } from "@apollo/client/link/error";
import { fromPromise } from "@apollo/client/link/utils";
import { getAuthHeaders } from "../common/authentication/auth";
import { executeTokenRefresh } from "../common/authentication/tokenRefreshManager";
import onRefreshFails from "../common/authentication/onRefreshFails";
import logger from "../common/logger/logger";

interface ApolloClienContext {
  headers?: HeadersInit;
}

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined;

// Callback in attesa del completamento del refresh token
let pendingRequests: Array<(success: boolean) => void> = [];

const resolvePendingRequests = (success: boolean) => {
  pendingRequests.forEach((callback) => callback(success));
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

  const errorLink = onError(({ graphQLErrors, operation, forward }) => {
    if (graphQLErrors && graphQLErrors.some((err) => err.extensions?.code === "ACCESS_DENIED")) {
      logger.log("Received ACCESS_DENIED, attempting token refresh from Apollo Client");

      // Usa il manager centralizzato per il refresh del token
      const forward$ = fromPromise(
        executeTokenRefresh()
          .then((success) => {
            if (success) {
              resolvePendingRequests(success);
              return success;
            }
            resolvePendingRequests(false);
            onRefreshFails();
            return false;
          })
          .catch((error) => {
            logger.error("Token refresh failed in Apollo error link:", error);
            resolvePendingRequests(false);
            onRefreshFails();
            return false;
          })
      );

      // Dopo il completamento del refresh, aggiorna gli headers e riprova la richiesta
      return forward$.flatMap((success) => {
        if (!success) {
          // Se il refresh è fallito, non riprovare la richiesta
          return fromPromise(Promise.reject(new Error("Token refresh failed")));
        }

        const authHeaders = getAuthHeaders();
        operation.setContext(({ headers = {} }) => ({
          headers: {
            ...headers,
            ...authHeaders,
          },
        }));
        return forward(operation);
      });
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
            chiusureMensili: {
              keyArgs: false,
              merge(existing = {}, incoming) {
                return { ...existing, ...incoming };
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
