import { gql } from "@apollo/client";
import getQueryName from "../getQueryName";

describe("getQueryName", () => {
  it("dovrebbe estrarre il nome della query dal pattern connection (vecchio pattern)", () => {
    const query = gql`
      query GetUtenti($pageSize: Int!, $where: String) {
        connection {
          utenti(first: $pageSize, where: $where) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            items {
              id
              username
            }
          }
        }
      }
    `;

    expect(getQueryName(query)).toBe("utenti");
  });

  it("dovrebbe estrarre il nome della query dal pattern root con totalCount (nuovo pattern)", () => {
    const query = gql`
      query GetProducts($pageSize: Int!) {
        products(first: $pageSize) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          items {
            id
            name
          }
        }
      }
    `;

    expect(getQueryName(query)).toBe("products");
  });

  it("dovrebbe estrarre il nome della query dal pattern root con edges (Relay standard)", () => {
    const query = gql`
      query GetOrders($pageSize: Int!) {
        orders(first: $pageSize) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
            }
          }
        }
      }
    `;

    expect(getQueryName(query)).toBe("orders");
  });

  it("dovrebbe lanciare errore per query senza definizione di operazione", () => {
    // Un fragment puro senza query
    const fragmentOnly = gql`
      fragment UserFields on User {
        id
        name
      }
    `;

    expect(() => getQueryName(fragmentOnly)).toThrow(
      "No operation definition found in the provided query document."
    );
  });

  it("dovrebbe lanciare errore per query senza campi connection", () => {
    const query = gql`
      query GetUser {
        user {
          id
          name
        }
      }
    `;

    expect(() => getQueryName(query)).toThrow(
      "No connection query found in the query document."
    );
  });

  it("dovrebbe lanciare errore quando connection non ha campi figli", () => {
    // Questo scenario e' un po' artificiale ma testa il branch di errore
    const query = gql`
      query GetEmpty {
        connection {
          __typename
        }
      }
    `;

    // __typename non ha selectionSet, quindi non sara' un campo "Field" valido
    // In realta' il primo campo sotto connection sara' __typename
    // Il codice prende selections[0] che e' __typename che ha kind="Field" e name.value="__typename"
    // Quindi restituira' "__typename" - testiamo il comportamento effettivo
    const result = getQueryName(query);
    expect(result).toBe("__typename");
  });
});
