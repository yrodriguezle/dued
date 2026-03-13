import { renderHook, waitFor } from "@testing-library/react";
import { ApolloClient, InMemoryCache, ApolloProvider, ApolloLink, Observable } from "@apollo/client";
import { ReactNode } from "react";
import useGetAll from "../useGetAll";

// useGetAll genera query dinamicamente tramite useQueryParams+gql, percio' non possiamo
// usare MockedProvider (che richiede il documento esatto). Usiamo un ApolloClient
// con un link custom che intercetta tutte le richieste.

const createMockClient = (
  queryHandler: (variables: Record<string, unknown>) => unknown
) => {
  const mockLink = new ApolloLink((operation) => {
    return new Observable((observer) => {
      const data = queryHandler(operation.variables);
      setTimeout(() => {
        observer.next({ data });
        observer.complete();
      }, 0);
    });
  });

  return new ApolloClient({
    link: mockLink,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            connection: {
              keyArgs: false,
              merge(existing = {}, incoming: Record<string, unknown>) {
                return { ...existing, ...incoming };
              },
            },
          },
        },
      },
    }),
  });
};

const createWrapper = (client: ApolloClient<unknown>) =>
  ({ children }: { children: ReactNode }) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );

// Il fragment dummy serve perche' useGetAll usa sempre fragmentBody come stringa
// e useQueryParams richiede fragment non vuoto quando body e' una stringa
const TEST_FRAGMENT = "fragment TestItemFragment on TestItem { id name }";
const TEST_FRAGMENT_BODY = "...TestItemFragment";

describe("useGetAll", () => {
  it("dovrebbe recuperare tutti i dati con paginazione Relay", async () => {
    const client = createMockClient(() => ({
      connection: {
        testItems: {
          totalCount: 2,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
            hasPreviousPage: false,
            startCursor: null,
          },
          items: [
            { id: 1, name: "Item 1" },
            { id: 2, name: "Item 2" },
          ],
        },
      },
    }));

    const wrapper = createWrapper(client);

    const { result } = renderHook(
      () =>
        useGetAll<{ id: number; name: string }>({
          queryName: "testItems" as never,
          fragment: TEST_FRAGMENT,
          fragmentBody: TEST_FRAGMENT_BODY,
          fetchPolicy: "no-cache",
        }),
      { wrapper }
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data[0]).toEqual({ id: 1, name: "Item 1" });
    expect(result.current.error).toBeNull();
  });

  it("dovrebbe gestire risultati vuoti", async () => {
    const client = createMockClient(() => ({
      connection: {
        testItems: {
          totalCount: 0,
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
            hasPreviousPage: false,
            startCursor: null,
          },
          items: [],
        },
      },
    }));

    const wrapper = createWrapper(client);

    const { result } = renderHook(
      () =>
        useGetAll<{ id: number; name: string }>({
          queryName: "testItems" as never,
          fragment: TEST_FRAGMENT,
          fragmentBody: TEST_FRAGMENT_BODY,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it("dovrebbe saltare il recupero quando skip è true", async () => {
    const client = createMockClient(() => ({
      connection: {
        testItems: {
          totalCount: 0,
          pageInfo: { hasNextPage: false, endCursor: null, hasPreviousPage: false, startCursor: null },
          items: [],
        },
      },
    }));

    const wrapper = createWrapper(client);

    const { result } = renderHook(
      () =>
        useGetAll<{ id: number; name: string }>({
          queryName: "testItems" as never,
          fragment: TEST_FRAGMENT,
          fragmentBody: TEST_FRAGMENT_BODY,
          skip: true,
        }),
      { wrapper }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toHaveLength(0);
  });

  it("dovrebbe esporre la funzione refetch", async () => {
    const client = createMockClient(() => ({
      connection: {
        testItems: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null, hasPreviousPage: false, startCursor: null },
          items: [{ id: 1, name: "Item 1" }],
        },
      },
    }));

    const wrapper = createWrapper(client);

    const { result } = renderHook(
      () =>
        useGetAll<{ id: number; name: string }>({
          queryName: "testItems" as never,
          fragment: TEST_FRAGMENT,
          fragmentBody: TEST_FRAGMENT_BODY,
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe("function");
  });

  it("dovrebbe gestire paginazione con piu' pagine (fetchMore)", async () => {
    let callCount = 0;
    const client = createMockClient(() => {
      callCount++;
      if (callCount === 1) {
        return {
          connection: {
            testItems: {
              totalCount: 4,
              pageInfo: {
                hasNextPage: true,
                endCursor: "2",
                hasPreviousPage: false,
                startCursor: null,
              },
              items: [
                { id: 1, name: "Item 1" },
                { id: 2, name: "Item 2" },
              ],
            },
          },
        };
      }
      return {
        connection: {
          testItems: {
            totalCount: 4,
            pageInfo: {
              hasNextPage: false,
              endCursor: null,
              hasPreviousPage: true,
              startCursor: "2",
            },
            items: [
              { id: 3, name: "Item 3" },
              { id: 4, name: "Item 4" },
            ],
          },
        },
      };
    });

    const wrapper = createWrapper(client);

    const { result } = renderHook(
      () =>
        useGetAll<{ id: number; name: string }>({
          queryName: "testItems" as never,
          fragment: TEST_FRAGMENT,
          fragmentBody: TEST_FRAGMENT_BODY,
          pageSize: 2,
          fetchPolicy: "no-cache",
        }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // useGetAll fetcha tutte le pagine automaticamente
    expect(result.current.data).toHaveLength(4);
  });
});
