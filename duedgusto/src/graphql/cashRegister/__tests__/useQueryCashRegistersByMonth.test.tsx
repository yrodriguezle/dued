import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import useQueryCashRegistersByMonth from "../useQueryCashRegistersByMonth";
import { getRegistriCassa } from "../queries";

const createWrapper = (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );

const makeMockRegistro = (overrides: Record<string, unknown>) => ({
  __typename: "RegistroCassa",
  id: 1,
  utenteId: 1,
  totaleApertura: 100,
  totaleChiusura: 500,
  venditeContanti: 300,
  incassoContanteTracciato: 200,
  incassiElettronici: 150,
  incassiFattura: 50,
  totaleVendite: 400,
  speseFornitori: 30,
  speseGiornaliere: 20,
  contanteAtteso: 350,
  differenza: 0,
  contanteNetto: 350,
  importoIva: 80,
  note: null,
  stato: "DRAFT",
  creatoIl: "2026-03-01T08:00:00Z",
  aggiornatoIl: "2026-03-01T08:00:00Z",
  utente: {
    __typename: "Utente",
    id: 1,
    nomeUtente: "admin",
    nome: "Admin",
    cognome: "User",
    descrizione: "",
    disabilitato: false,
    ruoloId: 1,
    ruolo: { __typename: "Ruolo", id: 1, nome: "Admin", descrizione: "", menuIds: [] },
    menus: [],
  },
  conteggiApertura: [],
  conteggiChiusura: [],
  incassi: [],
  spese: [],
  pagamentiFornitori: [],
  ...overrides,
});

const mockRegistriCassa = [
  makeMockRegistro({ id: 1, data: "2026-03-01T00:00:00.000Z" }),
  makeMockRegistro({ id: 2, data: "2026-03-15T00:00:00.000Z" }),
  makeMockRegistro({ id: 3, data: "2026-03-31T00:00:00.000Z" }),
];

const createConnectionMock = (
  items: unknown[],
  matcher: (vars: Record<string, unknown>) => boolean = () => true,
  hasNextPage = false
): MockedResponse => ({
  request: { query: getRegistriCassa },
  variableMatcher: matcher,
  result: {
    data: {
      connection: {
        __typename: "ConnectionQueries",
        registriCassa: {
          __typename: "RegistriCassaConnection",
          totalCount: items.length,
          pageInfo: {
            __typename: "PageInfo",
            hasNextPage,
            endCursor: null,
            hasPreviousPage: false,
            startCursor: null,
          },
          items,
        },
      },
    },
  },
});

describe("useQueryCashRegistersByMonth", () => {
  it("dovrebbe restituire i registri cassa filtrati per mese e anno", async () => {
    const mock = createConnectionMock(
      mockRegistriCassa,
      (vars) =>
        vars?.pageSize === 100 &&
        typeof vars?.where === "string" &&
        (vars.where as string).includes("2026-03-01")
    );

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(
      () => useQueryCashRegistersByMonth({ year: 2026, month: 3 }),
      { wrapper }
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.registriCassa).toHaveLength(3);
    expect(result.current.cashRegisters).toHaveLength(3);
    expect(result.current.error).toBeUndefined();
  });

  it("dovrebbe gestire risultati vuoti", async () => {
    const mock = createConnectionMock(
      [],
      (vars) =>
        typeof vars?.where === "string" &&
        (vars.where as string).includes("2026-04")
    );

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(
      () => useQueryCashRegistersByMonth({ year: 2026, month: 4 }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.registriCassa).toHaveLength(0);
    expect(result.current.cashRegisters).toHaveLength(0);
  });

  it("dovrebbe gestire lo stato di errore", async () => {
    const errorMock: MockedResponse = {
      request: { query: getRegistriCassa },
      variableMatcher: () => true,
      error: new Error("Errore nel recupero dati"),
    };

    const wrapper = createWrapper([errorMock]);

    const { result } = renderHook(
      () => useQueryCashRegistersByMonth({ year: 2026, month: 3 }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.registriCassa).toHaveLength(0);
  });

  it("dovrebbe saltare la query quando skip è true", () => {
    const wrapper = createWrapper([]);

    const { result } = renderHook(
      () => useQueryCashRegistersByMonth({ year: 2026, month: 3, skip: true }),
      { wrapper }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.registriCassa).toHaveLength(0);
  });
});
