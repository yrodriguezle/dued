import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import useQueryYearlySummary from "../useQueryYearlySummary";
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
  stato: "CLOSED",
  creatoIl: "2026-01-01T08:00:00Z",
  aggiornatoIl: "2026-01-01T08:00:00Z",
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

const createConnectionMock = (
  items: unknown[],
  matcher: (vars: Record<string, unknown>) => boolean
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
            hasNextPage: false,
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

describe("useQueryYearlySummary", () => {
  it("dovrebbe restituire il riepilogo annuale con dati mensili aggregati", async () => {
    const mockItems = [
      makeMockRegistro({
        id: 1,
        data: "2026-01-15T00:00:00.000Z",
        totaleChiusura: 500,
        incassiFattura: 50,
        totaleApertura: 100,
        speseFornitori: 30,
        speseGiornaliere: 20,
        incassoContanteTracciato: 200,
        incassiElettronici: 150,
        differenza: 0,
        importoIva: 80,
      }),
      makeMockRegistro({
        id: 2,
        data: "2026-01-20T00:00:00.000Z",
        totaleChiusura: 600,
        incassiFattura: 60,
        totaleApertura: 120,
        speseFornitori: 40,
        speseGiornaliere: 25,
        incassoContanteTracciato: 250,
        incassiElettronici: 180,
        differenza: 0,
        importoIva: 90,
      }),
      makeMockRegistro({
        id: 3,
        data: "2026-03-10T00:00:00.000Z",
        totaleChiusura: 700,
        incassiFattura: 70,
        totaleApertura: 130,
        speseFornitori: 50,
        speseGiornaliere: 30,
        incassoContanteTracciato: 300,
        incassiElettronici: 200,
        differenza: 10,
        importoIva: 100,
      }),
    ];

    const mock = createConnectionMock(
      mockItems,
      (vars) =>
        vars?.pageSize === 1000 &&
        typeof vars?.where === "string" &&
        (vars.where as string).includes("2026-01-01")
    );

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(
      () => useQueryYearlySummary({ year: 2026 }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 12 mesi inizializzati
    expect(result.current.data.monthlyData).toHaveLength(12);

    // Gennaio: 2 registri
    const january = result.current.data.monthlyData.find((m) => m.month === 1);
    expect(january?.count).toBe(2);
    expect(january?.totalCash).toBe(450); // 200 + 250
    expect(january?.totalElectronic).toBe(330); // 150 + 180

    // Marzo: 1 registro
    const march = result.current.data.monthlyData.find((m) => m.month === 3);
    expect(march?.count).toBe(1);
    expect(march?.totalCash).toBe(300);
    expect(march?.totalElectronic).toBe(200);

    // Totali annuali
    expect(result.current.data.yearlyTotals.count).toBe(3);
    expect(result.current.data.yearlyTotals.totalCash).toBe(750);
    expect(result.current.data.yearlyTotals.totalElectronic).toBe(530);
  });

  it("dovrebbe gestire dati vuoti restituendo tutti i mesi a zero", async () => {
    const mock = createConnectionMock(
      [],
      (vars) =>
        vars?.pageSize === 1000 &&
        typeof vars?.where === "string" &&
        (vars.where as string).includes("2026")
    );

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(
      () => useQueryYearlySummary({ year: 2026 }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data.monthlyData).toHaveLength(12);
    expect(result.current.data.yearlyTotals.count).toBe(0);
    expect(result.current.data.yearlyTotals.totalRevenue).toBe(0);
    expect(result.current.data.yearlyTotals.averageDaily).toBe(0);
  });

  it("dovrebbe saltare la query quando skip è true", () => {
    const wrapper = createWrapper([]);

    const { result } = renderHook(
      () => useQueryYearlySummary({ year: 2026, skip: true }),
      { wrapper }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data.monthlyData).toHaveLength(12);
    expect(result.current.data.yearlyTotals.count).toBe(0);
  });
});
