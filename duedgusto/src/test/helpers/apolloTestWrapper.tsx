/**
 * Apollo Test Wrapper
 *
 * Fornisce un MockedProvider configurato con le stesse cache policies di produzione
 * per testare componenti e hook che dipendono da Apollo Client.
 */
import { ReactNode } from "react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { InMemoryCache } from "@apollo/client";
import { DocumentNode } from "graphql";

/**
 * Crea un'istanza di InMemoryCache con le stesse typePolicies usate in produzione
 * (vedi configureClient.tsx)
 */
export const createTestCache = () =>
  new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          connection: {
            keyArgs: false,
            merge(existing = {}, incoming) {
              return { ...existing, ...incoming };
            },
          },
          gestioneCassa: {
            keyArgs: false,
            merge(existing = {}, incoming) {
              return { ...existing, ...incoming };
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
  });

interface CreateMockApolloProviderOptions {
  mocks?: MockedResponse[];
  addTypename?: boolean;
  cache?: InMemoryCache;
}

/**
 * Crea un wrapper MockedProvider per i test.
 * Usa le stesse cache policies della configurazione di produzione.
 */
export const createMockApolloProvider = ({
  mocks = [],
  addTypename = false,
  cache,
}: CreateMockApolloProviderOptions = {}) => {
  const testCache = cache ?? createTestCache();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks} addTypename={addTypename} cache={testCache}>
      {children}
    </MockedProvider>
  );

  return Wrapper;
};

/**
 * Factory per creare mock response GraphQL con tipo sicuro.
 */
export const createMockResponse = <TData extends Record<string, unknown>, TVars = Record<string, unknown>>(
  query: DocumentNode,
  data: TData,
  variables?: TVars
): MockedResponse => ({
  request: {
    query,
    ...(variables ? { variables } : {}),
  },
  result: {
    data,
  },
});

/**
 * Factory per creare mock response con errore GraphQL.
 */
export const createMockErrorResponse = <TVars = Record<string, unknown>>(
  query: DocumentNode,
  errorMessage: string,
  variables?: TVars
): MockedResponse => ({
  request: {
    query,
    ...(variables ? { variables } : {}),
  },
  error: new Error(errorMessage),
});

/**
 * Factory per creare mock response con errori GraphQL specifici.
 */
export const createMockGraphQLErrorResponse = <TVars = Record<string, unknown>>(
  query: DocumentNode,
  errors: Array<{ message: string; extensions?: Record<string, unknown> }>,
  variables?: TVars
): MockedResponse => ({
  request: {
    query,
    ...(variables ? { variables } : {}),
  },
  result: {
    errors: errors as never,
  },
});
