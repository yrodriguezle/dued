import { renderHook, act } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import useCloseCashRegister from "../useCloseCashRegister";
import { mutationChiudiRegistroCassa } from "../mutations";

const createWrapper = (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );

const mockClosedRegister = {
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
  stato: "CLOSED",
  creatoIl: "2026-03-12T08:00:00Z",
  aggiornatoIl: "2026-03-12T10:00:00Z",
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
};

describe("useCloseCashRegister", () => {
  it("dovrebbe chiamare la mutation di chiusura e restituire il risultato", async () => {
    const mock: MockedResponse = {
      request: { query: mutationChiudiRegistroCassa },
      variableMatcher: (vars) => vars?.registroCassaId === 1,
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementMutations",
            chiudiRegistroCassa: mockClosedRegister,
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(() => useCloseCashRegister(), { wrapper });

    expect(result.current.loading).toBe(false);

    let closeResult: unknown;
    await act(async () => {
      closeResult = await result.current.chiudiRegistroCassa(1);
    });

    expect(closeResult).toBeDefined();
    expect((closeResult as typeof mockClosedRegister).stato).toBe("CLOSED");
    expect((closeResult as typeof mockClosedRegister).id).toBe(1);
  });

  it("dovrebbe esporre l'alias legacy closeCashRegister", () => {
    const wrapper = createWrapper([]);

    const { result } = renderHook(() => useCloseCashRegister(), { wrapper });

    expect(result.current.closeCashRegister).toBeDefined();
    expect(result.current.closeCashRegister).toBe(result.current.chiudiRegistroCassa);
  });

  it("dovrebbe restituire null quando la risposta non contiene dati", async () => {
    const mock: MockedResponse = {
      request: { query: mutationChiudiRegistroCassa },
      variableMatcher: () => true,
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementMutations",
            chiudiRegistroCassa: null,
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(() => useCloseCashRegister(), { wrapper });

    let closeResult: unknown;
    await act(async () => {
      closeResult = await result.current.chiudiRegistroCassa(99);
    });

    expect(closeResult).toBeNull();
  });

  it("dovrebbe gestire errori nella mutation di chiusura", async () => {
    const errorMock: MockedResponse = {
      request: { query: mutationChiudiRegistroCassa },
      variableMatcher: () => true,
      error: new Error("Errore nella chiusura del registro"),
    };

    const wrapper = createWrapper([errorMock]);

    const { result } = renderHook(() => useCloseCashRegister(), { wrapper });

    await expect(
      act(async () => {
        await result.current.chiudiRegistroCassa(1);
      })
    ).rejects.toThrow();
  });
});
