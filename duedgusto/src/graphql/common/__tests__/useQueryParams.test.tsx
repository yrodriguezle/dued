import { renderHook } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { ReactNode } from "react";
import useQueryParams from "../useQueryParams";

const createWrapper = () =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={[]}>{children}</MockedProvider>
  );

describe("useQueryParams", () => {
  it("dovrebbe generare query e variabili con body array", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQueryParams<{ id: number; name: string }>({
          queryName: "utenti" as never,
          body: ["id", "name"] as never,
          pageSize: 25,
          where: "active = true",
          orderBy: "name ASC",
        }),
      { wrapper }
    );

    expect(result.current.query).toBeDefined();
    expect(result.current.variables).toEqual({
      pageSize: 25,
      where: "active = true",
      orderBy: "name ASC",
      cursor: 0,
    });
  });

  it("dovrebbe generare query e variabili con body stringa e fragment", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQueryParams<{ id: number; name: string }>({
          queryName: "utenti" as never,
          body: "...UtenteFragment",
          fragment: "fragment UtenteFragment on Utente { id name }",
          pageSize: 50,
        }),
      { wrapper }
    );

    expect(result.current.query).toBeDefined();
    expect(result.current.variables.pageSize).toBe(50);
    expect(result.current.variables.cursor).toBe(0);
    expect(result.current.variables.where).toBe("");
  });

  it("dovrebbe lanciare errore quando body è stringa ma fragment è mancante", () => {
    const wrapper = createWrapper();

    expect(() => {
      renderHook(
        () =>
          useQueryParams<{ id: number }>({
            queryName: "items" as never,
            body: "...ItemFragment",
            fragment: "",
            pageSize: 10,
          }),
        { wrapper }
      );
    }).toThrow("Il parametro 'fragment' è obbligatorio quando body è una stringa.");
  });

  it("dovrebbe normalizzare il parametro where rimuovendo spazi extra e newline", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQueryParams<{ id: number }>({
          queryName: "items" as never,
          body: ["id"] as never,
          pageSize: 10,
          where: "name = 'test'\n  AND   active = true",
        }),
      { wrapper }
    );

    expect(result.current.variables.where).toBe("name = 'test' AND active = true");
  });

  it("dovrebbe usare cursor 0 come default", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQueryParams<{ id: number }>({
          queryName: "items" as never,
          body: ["id"] as never,
          pageSize: 10,
        }),
      { wrapper }
    );

    expect(result.current.variables.cursor).toBe(0);
  });

  it("dovrebbe usare il cursor fornito quando specificato", () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () =>
        useQueryParams<{ id: number }>({
          queryName: "items" as never,
          body: ["id"] as never,
          pageSize: 10,
          cursor: 50,
        }),
      { wrapper }
    );

    expect(result.current.variables.cursor).toBe(50);
  });
});
