import { renderHook, act } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import useReopenCashRegister from "../useReopenCashRegister";
import { mutationRiapriRegistroCassa } from "../mutations";
import { describe, expect, it } from "vitest";

const createWrapper = (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );

const mockReopenedRegister = {
  __typename: "RegistroCassa",
  id: 594,
  data: "2026-07-04",
  utenteId: 1,
  totaleApertura: 45.85,
  totaleChiusura: 213.95,
  venditeContanti: 0,
  incassoContanteTracciato: 0,
  incassiElettronici: 0,
  incassiFattura: 0,
  totaleVendite: 168.1,
  speseFornitori: 0,
  speseGiornaliere: 0,
  restoFornitore: 0,
  ecc: 0,
  resto: 0,
  contanteNetto: 168.1,
  importoIva: 0,
  breakdownIva: [],
  note: null,
  stato: "DRAFT",
  createdAt: "2026-07-04T08:00:00Z",
  updatedAt: "2026-08-08T10:00:00Z",
  utente: {
    __typename: "Utente",
    id: 1,
    nomeUtente: "admin",
    nome: "Admin",
    cognome: "User",
    descrizione: "",
    disabilitato: false,
    ruoloId: 1,
    ruolo: { __typename: "Ruolo", id: 1, nome: "Admin", descrizione: "", amministratore: true, menuIds: [] },
    menus: [],
  },
  conteggiApertura: [],
  conteggiChiusura: [],
  incassi: [],
  spese: [],
  pagamentiFornitori: [],
};

describe("useReopenCashRegister", () => {
  it("dovrebbe chiamare la mutation di riapertura e riportare lo stato a DRAFT", async () => {
    const mock: MockedResponse = {
      request: { query: mutationRiapriRegistroCassa },
      variableMatcher: (vars) => vars?.registroCassaId === 594,
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementMutations",
            riapriRegistroCassa: mockReopenedRegister,
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(() => useReopenCashRegister(), { wrapper });

    expect(result.current.loading).toBe(false);

    let reopenResult: unknown;
    await act(async () => {
      reopenResult = await result.current.riapriRegistroCassa(594);
    });

    expect(reopenResult).toBeDefined();
    expect((reopenResult as typeof mockReopenedRegister).stato).toBe("DRAFT");
    expect((reopenResult as typeof mockReopenedRegister).id).toBe(594);
  });

  it("dovrebbe restituire null quando la risposta non contiene dati", async () => {
    const mock: MockedResponse = {
      request: { query: mutationRiapriRegistroCassa },
      variableMatcher: () => true,
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementMutations",
            riapriRegistroCassa: null,
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(() => useReopenCashRegister(), { wrapper });

    let reopenResult: unknown;
    await act(async () => {
      reopenResult = await result.current.riapriRegistroCassa(99);
    });

    expect(reopenResult).toBeNull();
  });

  it("dovrebbe propagare l'errore quando il ruolo non e amministratore", async () => {
    const errorMock: MockedResponse = {
      request: { query: mutationRiapriRegistroCassa },
      variableMatcher: () => true,
      error: new Error("Operazione riservata agli amministratori: il tuo ruolo non ha i privilegi necessari."),
    };

    const wrapper = createWrapper([errorMock]);

    const { result } = renderHook(() => useReopenCashRegister(), { wrapper });

    await expect(
      act(async () => {
        await result.current.riapriRegistroCassa(594);
      })
    ).rejects.toThrow(/amministratori/);
  });
});
