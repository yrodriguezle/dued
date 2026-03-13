import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import useQueryCashRegister from "../useQueryCashRegister";
import { getRegistroCassa } from "../queries";

const createWrapper = (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );

const mockRegistroCassa = {
  __typename: "RegistroCassa",
  id: 1,
  data: "2026-03-12",
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
  creatoIl: "2026-03-12T08:00:00Z",
  aggiornatoIl: "2026-03-12T08:00:00Z",
  utente: {
    __typename: "Utente",
    id: 1,
    nomeUtente: "admin",
    nome: "Admin",
    cognome: "User",
    descrizione: "",
    disabilitato: false,
    ruoloId: 1,
    ruolo: {
      __typename: "Ruolo",
      id: 1,
      nome: "Admin",
      descrizione: "Administrator",
      menuIds: [],
    },
    menus: [],
  },
  conteggiApertura: [],
  conteggiChiusura: [],
  incassi: [],
  spese: [],
  pagamentiFornitori: [],
};

describe("useQueryCashRegister", () => {
  it("dovrebbe restituire i dati del registro cassa dal mock", async () => {
    const mock: MockedResponse = {
      request: { query: getRegistroCassa },
      variableMatcher: (vars) => vars?.data === "2026-03-12",
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementQueries",
            registroCassa: mockRegistroCassa,
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(
      () => useQueryCashRegister({ data: "2026-03-12" }),
      { wrapper }
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.registroCassa).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.registroCassa).toBeDefined();
    expect(result.current.registroCassa?.id).toBe(1);
    expect(result.current.registroCassa?.data).toBe("2026-03-12");
    expect(result.current.cashRegister).toEqual(result.current.registroCassa);
    expect(result.current.error).toBeUndefined();
  });

  it("dovrebbe gestire lo stato di loading correttamente", async () => {
    const mock: MockedResponse = {
      request: { query: getRegistroCassa },
      variableMatcher: () => true,
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementQueries",
            registroCassa: mockRegistroCassa,
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(
      () => useQueryCashRegister({ data: "2026-03-12" }),
      { wrapper }
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("dovrebbe gestire lo stato di errore", async () => {
    const errorMock: MockedResponse = {
      request: { query: getRegistroCassa },
      variableMatcher: () => true,
      error: new Error("Errore di rete"),
    };

    const wrapper = createWrapper([errorMock]);

    const { result } = renderHook(
      () => useQueryCashRegister({ data: "2026-03-12" }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.registroCassa).toBeNull();
  });

  it("dovrebbe saltare la query quando skip è true", async () => {
    const wrapper = createWrapper([]);

    const { result } = renderHook(
      () => useQueryCashRegister({ data: "2026-03-12", skip: true }),
      { wrapper }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.registroCassa).toBeNull();
  });
});
