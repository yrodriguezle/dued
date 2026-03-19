import { renderHook, waitFor, act } from "@testing-library/react";
import { gql, ApolloClient, InMemoryCache, ApolloProvider, ApolloLink, Observable } from "@apollo/client";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import { vi, afterEach } from "vitest";
import useFetchData from "../useFetchData";

// Query di test con pattern connection (senza fragment per semplicita')
const TEST_QUERY = gql`
  query GetTestItems($pageSize: Int!, $where: String, $orderBy: String, $after: String) {
    connection {
      testItems(first: $pageSize, where: $where, orderBy: $orderBy, after: $after) {
        totalCount
        pageInfo {
          hasNextPage
          endCursor
          hasPreviousPage
          startCursor
        }
        items {
          id
          name
        }
      }
    }
  }
`;

const mockItems = [
  { __typename: "TestItem", id: 1, name: "Item 1" },
  { __typename: "TestItem", id: 2, name: "Item 2" },
  { __typename: "TestItem", id: 3, name: "Item 3" },
];

const defaultVariables = {
  pageSize: 10,
  where: "",
  orderBy: "id ASC",
};

const createWrapper = (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );

// ─── Helper: ApolloClient con link custom che registra le chiamate ─────────

interface QueryCall {
  variables: Record<string, unknown>;
}

const createSpyClient = (onQuery: (call: QueryCall) => Record<string, unknown>) => {
  const mockLink = new ApolloLink((operation) => {
    return new Observable((observer) => {
      const data = onQuery({ variables: operation.variables });
      // setTimeout(0) simula la risposta asincrona del server
      setTimeout(() => {
        observer.next({ data });
        observer.complete();
      }, 0);
    });
  });

  return new ApolloClient({
    link: mockLink,
    cache: new InMemoryCache({ addTypename: false }),
  });
};

const createSpyWrapper = (client: ApolloClient<unknown>) =>
  ({ children }: { children: ReactNode }) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );

describe("useFetchData", () => {
  it("dovrebbe recuperare i dati al montaggio dopo il debounce", async () => {
    const mock: MockedResponse = {
      request: { query: TEST_QUERY },
      variableMatcher: () => true,
      result: {
        data: {
          connection: {
            __typename: "ConnectionQueries",
            testItems: {
              __typename: "TestItemsConnection",
              totalCount: 3,
              pageInfo: {
                __typename: "PageInfo",
                hasNextPage: false,
                endCursor: null,
                hasPreviousPage: false,
                startCursor: null,
              },
              items: mockItems,
            },
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(
      () =>
        useFetchData({
          query: TEST_QUERY,
          variables: defaultVariables,
        }),
      { wrapper }
    );

    expect(result.current.items).toHaveLength(0);

    await waitFor(
      () => {
        expect(result.current.items).toHaveLength(3);
      },
      { timeout: 2000 }
    );

    expect(result.current.totalCount).toBe(3);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it("dovrebbe non recuperare dati quando skip è true", async () => {
    const wrapper = createWrapper([]);

    const { result } = renderHook(
      () =>
        useFetchData({
          query: TEST_QUERY,
          variables: defaultVariables,
          skip: true,
        }),
      { wrapper }
    );

    // Aspetta piu' del tempo di debounce
    await new Promise((r) => setTimeout(r, 500));

    expect(result.current.items).toHaveLength(0);
    expect(result.current.loading).toBe(false);
  });

  it("dovrebbe gestire errori nel recupero dati", async () => {
    const errorMock: MockedResponse = {
      request: { query: TEST_QUERY },
      variableMatcher: () => true,
      error: new Error("Errore di rete"),
    };

    const wrapper = createWrapper([errorMock]);

    const { result } = renderHook(
      () =>
        useFetchData({
          query: TEST_QUERY,
          variables: defaultVariables,
        }),
      { wrapper }
    );

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
        expect(result.current.items).toHaveLength(0);
      },
      { timeout: 2000 }
    );

    expect(result.current.totalCount).toBe(0);
  });

  it("dovrebbe esporre la funzione fetchItems", () => {
    const wrapper = createWrapper([]);

    const { result } = renderHook(
      () =>
        useFetchData({
          query: TEST_QUERY,
          variables: defaultVariables,
          skip: true,
        }),
      { wrapper }
    );

    expect(result.current.fetchItems).toBeDefined();
    expect(typeof result.current.fetchItems).toBe("function");
  });

  it("dovrebbe impostare hasMore correttamente quando ci sono piu' pagine", async () => {
    const mock: MockedResponse = {
      request: { query: TEST_QUERY },
      variableMatcher: () => true,
      result: {
        data: {
          connection: {
            __typename: "ConnectionQueries",
            testItems: {
              __typename: "TestItemsConnection",
              totalCount: 30,
              pageInfo: {
                __typename: "PageInfo",
                hasNextPage: true,
                endCursor: "10",
                hasPreviousPage: false,
                startCursor: null,
              },
              items: mockItems,
            },
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(
      () =>
        useFetchData({
          query: TEST_QUERY,
          variables: defaultVariables,
        }),
      { wrapper }
    );

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
        expect(result.current.items).toHaveLength(3);
      },
      { timeout: 2000 }
    );

    expect(result.current.hasMore).toBe(true);
    expect(result.current.totalCount).toBe(30);
    expect(result.current.cursor).toBe(3);
  });
});

// ─── Debounce behaviour ────────────────────────────────────────────────────
//
// Questi test verificano che il setTimeout da 300ms in useFetchData (riga ~62)
// funzioni correttamente: la query non deve scattare prima del delay, le
// chiamate rapide devono essere annullate, e il timer deve essere ripulito
// al momento dello smontaggio del componente.

describe("useFetchData — debounce (300ms)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("la query NON parte immediatamente al montaggio — aspetta il delay di 300ms", async () => {
    vi.useFakeTimers();

    const querySpy = vi.fn(() => ({
      connection: {
        testItems: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null, hasPreviousPage: false, startCursor: null },
          items: [{ id: 1, name: "Item 1" }],
        },
      },
    }));

    const client = createSpyClient(querySpy);
    const wrapper = createSpyWrapper(client);

    renderHook(
      () => useFetchData({ query: TEST_QUERY, variables: defaultVariables }),
      { wrapper }
    );

    // Subito dopo il mount: il watchQuery non deve ancora essere stato chiamato
    // perché il setTimeout da 300ms non è ancora scaduto.
    expect(querySpy).not.toHaveBeenCalled();

    // Avanza di 299ms: ancora nessuna chiamata
    act(() => { vi.advanceTimersByTime(299); });
    expect(querySpy).not.toHaveBeenCalled();

    // Avanza dell'ultimo ms: ora il timer scade e la query parte
    act(() => { vi.advanceTimersByTime(1); });

    // Ripristina i timer reali per permettere la risoluzione delle Promise
    vi.useRealTimers();

    await waitFor(() => {
      expect(querySpy).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });
  });

  it("cambiamenti rapidi delle variabili annullano il timer precedente — solo l'ultimo spara", async () => {
    vi.useFakeTimers();

    const querySpy = vi.fn(() => ({
      connection: {
        testItems: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null, hasPreviousPage: false, startCursor: null },
          items: [{ id: 1, name: "Item 1" }],
        },
      },
    }));

    const client = createSpyClient(querySpy);
    const wrapper = createSpyWrapper(client);

    const { rerender } = renderHook(
      ({ vars }: { vars: typeof defaultVariables }) =>
        useFetchData({ query: TEST_QUERY, variables: vars }),
      { wrapper, initialProps: { vars: defaultVariables } }
    );

    // Avanza 100ms senza che il timer scatti (< 300ms)
    act(() => { vi.advanceTimersByTime(100); });
    expect(querySpy).not.toHaveBeenCalled();

    // Cambia le variabili a 100ms: il precedente timer viene cancellato,
    // ne parte uno nuovo da 300ms.
    const vars2 = { ...defaultVariables, where: "secondo" };
    rerender({ vars: vars2 });

    // Avanza altri 100ms (siamo a 200ms dal nuovo timer, non ha ancora scattato)
    act(() => { vi.advanceTimersByTime(100); });
    expect(querySpy).not.toHaveBeenCalled();

    // Cambia ancora le variabili: un altro reset del timer
    const vars3 = { ...defaultVariables, where: "terzo" };
    rerender({ vars: vars3 });

    // Avanza 300ms: ora l'ultimo timer scade
    act(() => { vi.advanceTimersByTime(300); });

    // Ripristina i timer reali per permettere la risoluzione delle Promise
    vi.useRealTimers();

    await waitFor(() => {
      // Deve essere stato chiamato esattamente una volta con le variabili finali
      expect(querySpy).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });
  });

  it("quando skip è true il timer non lancia la query nemmeno dopo 300ms", async () => {
    vi.useFakeTimers();

    const querySpy = vi.fn(() => ({
      connection: {
        testItems: {
          totalCount: 0,
          pageInfo: { hasNextPage: false, endCursor: null, hasPreviousPage: false, startCursor: null },
          items: [],
        },
      },
    }));

    const client = createSpyClient(querySpy);
    const wrapper = createSpyWrapper(client);

    renderHook(
      () => useFetchData({ query: TEST_QUERY, variables: defaultVariables, skip: true }),
      { wrapper }
    );

    // Il timer scatta comunque (il clearTimeout non è chiamato), ma la guardia
    // `if (skip || !query || !variables) return` previene watchQuery.
    act(() => { vi.advanceTimersByTime(500); });

    expect(querySpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("smontare il componente prima dei 300ms cancella il timer (nessuna chiamata dopo l'unmount)", async () => {
    vi.useFakeTimers();

    const querySpy = vi.fn(() => ({
      connection: {
        testItems: {
          totalCount: 0,
          pageInfo: { hasNextPage: false, endCursor: null, hasPreviousPage: false, startCursor: null },
          items: [],
        },
      },
    }));

    const client = createSpyClient(querySpy);
    const wrapper = createSpyWrapper(client);

    const { unmount } = renderHook(
      () => useFetchData({ query: TEST_QUERY, variables: defaultVariables }),
      { wrapper }
    );

    // Smonta il componente prima che il timer scada
    act(() => { vi.advanceTimersByTime(100); });
    unmount();

    // Avanza oltre i 300ms: il clearTimeout nel cleanup deve aver annullato il timer
    act(() => { vi.advanceTimersByTime(500); });

    expect(querySpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("quando skip cambia da true a false il debounce si applica prima della query", async () => {
    vi.useFakeTimers();

    const querySpy = vi.fn(() => ({
      connection: {
        testItems: {
          totalCount: 1,
          pageInfo: { hasNextPage: false, endCursor: null, hasPreviousPage: false, startCursor: null },
          items: [{ id: 1, name: "Item 1" }],
        },
      },
    }));

    const client = createSpyClient(querySpy);
    const wrapper = createSpyWrapper(client);

    const { rerender } = renderHook(
      ({ skip }: { skip: boolean }) =>
        useFetchData({ query: TEST_QUERY, variables: defaultVariables, skip }),
      { wrapper, initialProps: { skip: true } }
    );

    // Con skip=true il timer gira ma la guardia blocca la query
    act(() => { vi.advanceTimersByTime(500); });
    expect(querySpy).not.toHaveBeenCalled();

    // Ora skip diventa false: l'useEffect ri-esegue, parte un nuovo timer da 300ms
    rerender({ skip: false });

    // Prima dei 300ms: ancora nessuna query
    act(() => { vi.advanceTimersByTime(200); });
    expect(querySpy).not.toHaveBeenCalled();

    // Dopo i 300ms: la query parte
    act(() => { vi.advanceTimersByTime(100); });

    vi.useRealTimers();

    await waitFor(() => {
      expect(querySpy).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });
  });
});
