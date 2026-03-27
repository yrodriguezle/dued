import { renderHook, act } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import useSubmitCashRegister from "../useSubmitCashRegister";
import { mutationSubmitRegistroCassa, SubmitRegistroCassaValues } from "../mutations";
import { getRegistroCassa } from "../queries";

const createWrapper = (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );

const mockInput: SubmitRegistroCassaValues = {
  registroCassa: {
    data: "2026-03-12",
    utenteId: 1,
    conteggiApertura: [],
    conteggiChiusura: [],
    spese: [],
    pagamentiFornitori: [],
    incassoContanteTracciato: 200,
    incassiElettronici: 150,
    incassiFattura: 50,
    speseFornitori: 30,
    speseGiornaliere: 20,
    note: "Test",
    stato: "DRAFT",
  },
};

const mockResultData = {
  __typename: "RegistroCassa",
  id: 1,
  data: "2026-03-12",
  utenteId: 1,
  totaleApertura: 0,
  totaleChiusura: 0,
  venditeContanti: 0,
  incassoContanteTracciato: 200,
  incassiElettronici: 150,
  incassiFattura: 50,
  totaleVendite: 400,
  speseFornitori: 30,
  speseGiornaliere: 20,
  contanteAtteso: 0,
  differenza: 0,
  contanteNetto: 0,
  importoIva: 0,
  note: "Test",
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
    ruolo: { __typename: "Ruolo", id: 1, nome: "Admin", descrizione: "", menuIds: [] },
    menus: [],
  },
  conteggiApertura: [],
  conteggiChiusura: [],
  incassi: [],
  spese: [],
  pagamentiFornitori: [],
};

const createRefetchMock = (): MockedResponse => ({
  request: {
    query: getRegistroCassa,
    variables: { data: "2026-03-12" },
  },
  result: {
    data: {
      gestioneCassa: {
        __typename: "CashManagementQueries",
        registroCassa: mockResultData,
      },
    },
  },
});

describe("useSubmitCashRegister", () => {
  it("dovrebbe chiamare la mutation e restituire il risultato", async () => {
    const mock: MockedResponse = {
      request: { query: mutationSubmitRegistroCassa },
      variableMatcher: (vars) => vars?.registroCassa?.data === "2026-03-12",
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementMutations",
            mutateRegistroCassa: mockResultData,
          },
        },
      },
    };

    const wrapper = createWrapper([mock, createRefetchMock()]);

    const { result } = renderHook(() => useSubmitCashRegister(), { wrapper });

    expect(result.current.loading).toBe(false);

    let submitResult: unknown;
    await act(async () => {
      submitResult = await result.current.submitRegistroCassa(mockInput);
    });

    expect(submitResult).toBeDefined();
    expect((submitResult as typeof mockResultData).id).toBe(1);
  });

  it("dovrebbe esporre l'alias legacy submitCashRegister", () => {
    const wrapper = createWrapper([]);

    const { result } = renderHook(() => useSubmitCashRegister(), { wrapper });

    expect(result.current.submitCashRegister).toBeDefined();
    expect(result.current.submitCashRegister).toBe(result.current.submitRegistroCassa);
  });

  it("dovrebbe restituire null quando la mutation non restituisce dati", async () => {
    const mock: MockedResponse = {
      request: { query: mutationSubmitRegistroCassa },
      variableMatcher: () => true,
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementMutations",
            mutateRegistroCassa: null,
          },
        },
      },
    };

    const wrapper = createWrapper([mock, createRefetchMock()]);

    const { result } = renderHook(() => useSubmitCashRegister(), { wrapper });

    let submitResult: unknown;
    await act(async () => {
      submitResult = await result.current.submitRegistroCassa(mockInput);
    });

    expect(submitResult).toBeNull();
  });

  it("dovrebbe gestire errori nella mutation", async () => {
    const errorMock: MockedResponse = {
      request: { query: mutationSubmitRegistroCassa },
      variableMatcher: () => true,
      error: new Error("Errore nel salvataggio"),
    };

    const wrapper = createWrapper([errorMock]);

    const { result } = renderHook(() => useSubmitCashRegister(), { wrapper });

    await expect(
      act(async () => {
        await result.current.submitRegistroCassa(mockInput);
      })
    ).rejects.toThrow();
  });
});
