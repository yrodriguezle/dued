import { renderHook, waitFor } from "@testing-library/react";
import { gql } from "@apollo/client";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
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
