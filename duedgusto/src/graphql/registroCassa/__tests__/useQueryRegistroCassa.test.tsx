import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import useQueryRegistroCassa from "../useQueryRegistroCassa";
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
  restoFornitore: 350,
  ecc: 0,
  resto: 0,
  contanteNetto: 350,
  importoIva: 80,
  breakdownIva: [
    { __typename: "RegistroCassaIva", aliquota: 22, imponibile: 320, imposta: 80, stimato: true },
  ],
  note: null,
  stato: "DRAFT",
  createdAt: "2026-03-12T08:00:00Z",
  updatedAt: "2026-03-12T08:00:00Z",
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

describe("useQueryRegistroCassa", () => {
  it("dovrebbe restituire i dati del registro cassa dal mock", async () => {
    const mock: MockedResponse = {
      request: { query: getRegistroCassa },
      variableMatcher: (vars) => vars?.data === "2026-03-12T00:00:00",
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
      () => useQueryRegistroCassa({ data: "2026-03-12" }),
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
      () => useQueryRegistroCassa({ data: "2026-03-12" }),
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
      () => useQueryRegistroCassa({ data: "2026-03-12" }),
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
      () => useQueryRegistroCassa({ data: "2026-03-12", skip: true }),
      { wrapper }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.registroCassa).toBeNull();
  });

  // 🔴 `registroCassa(data:)` sta su DateTimeGraphType, che pretende l'ISO-8601 completo: la data
  //    secca fa fallire la query in validazione con "Unable to convert '2026-03-12' to 'DateTime'",
  //    prima ancora che il resolver parta. Il PuntoVendita passava `dayjs().format("YYYY-MM-DD")`
  //    ed era per questo che la pagina non caricava. Qui si guarda la variabile spedita e non il
  //    risultato: il mock risponderebbe comunque, perche a rifiutare e il server vero.
  describe("normalizzazione della data", () => {
    const catturaVariabili = async (data: string) => {
      const spedite: Record<string, unknown>[] = [];
      const mock: MockedResponse = {
        request: { query: getRegistroCassa },
        variableMatcher: (vars) => {
          spedite.push(vars ?? {});
          return true;
        },
        result: {
          data: {
            gestioneCassa: {
              __typename: "CashManagementQueries",
              registroCassa: mockRegistroCassa,
            },
          },
        },
      };

      const { result } = renderHook(() => useQueryRegistroCassa({ data }), { wrapper: createWrapper([mock]) });
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      return spedite;
    };

    it("estende la data secca a mezzanotte prima di spedirla", async () => {
      const spedite = await catturaVariabili("2026-03-12");

      expect(spedite).toHaveLength(1);
      expect(spedite[0].data).toBe("2026-03-12T00:00:00");
    });

    it("lascia intatta una data gia estesa", async () => {
      const spedite = await catturaVariabili("2026-03-12T00:00:00");

      expect(spedite).toHaveLength(1);
      expect(spedite[0].data).toBe("2026-03-12T00:00:00");
    });
  });
});
