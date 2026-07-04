import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import { ReactNode } from "react";
import useQueryRiepilogoAnnuale from "../useQueryRiepilogoAnnuale";
import { getRiepilogoAnnuale } from "../queries";

const ANNO = 2026;

const createWrapper = (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => <MockedProvider mocks={mocks}>{children}</MockedProvider>;

const creaMeseServerMock = (mese: number, overrides: Record<string, unknown> = {}) => ({
  __typename: "RiepilogoMeseCassa",
  anno: ANNO,
  mese,
  totaleVendite: 0,
  ricavoTracciato: 0,
  ricavoNonTracciato: 0,
  speseTracciate: 0,
  speseNonTracciate: 0,
  incassoContanteTracciato: 0,
  incassiElettronici: 0,
  incassiFattura: 0,
  registri: 0,
  chiusi: 0,
  bozze: 0,
  ...overrides,
});

const createRiepilogoMock = (mesi: unknown[], anno = ANNO): MockedResponse => ({
  request: { query: getRiepilogoAnnuale, variables: { anno } },
  result: {
    data: {
      gestioneCassa: {
        __typename: "GestioneCassaQueries",
        riepilogoAnnuale: {
          __typename: "RiepilogoAnnualeCassa",
          anno,
          mesi,
        },
      },
    },
  },
});

const createValidationErrorMock = (anno = ANNO): MockedResponse => ({
  request: { query: getRiepilogoAnnuale, variables: { anno } },
  result: {
    errors: [
      new GraphQLError('Cannot query field "riepilogoAnnuale" on type "GestioneCassaQueries".', {
        extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
      }),
    ],
  },
});

describe("useQueryRiepilogoAnnuale", () => {
  it("normalizza i dati server garantendo 12 mesi con i derivati client", async () => {
    const mock = createRiepilogoMock([
      creaMeseServerMock(3, {
        totaleVendite: 930.7,
        ricavoTracciato: 580.4,
        ricavoNonTracciato: 350.3,
        speseTracciate: 30.3,
        speseNonTracciate: 35.2,
        incassoContanteTracciato: 300.1,
        incassiElettronici: 230.25,
        incassiFattura: 50.05,
        registri: 3,
        chiusi: 2,
        bozze: 1,
      }),
    ]);

    const { result } = renderHook(() => useQueryRiepilogoAnnuale({ anno: ANNO }), {
      wrapper: createWrapper([mock]),
    });

    await waitFor(() => {
      expect(result.current.hasData).toBe(true);
    });

    expect(result.current.mesi).toHaveLength(12);
    expect(result.current.mesi.map((m) => m.mese)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const marzo = result.current.mesi[2];
    expect(marzo.totaleVendite).toBeCloseTo(930.7, 2);
    // Derivati calcolati client-side
    expect(marzo.totaleSpese).toBeCloseTo(65.5, 2);
    expect(marzo.differenza).toBeCloseTo(865.2, 2);

    // I mesi mancanti dal server sono riempiti a zero
    expect(result.current.mesi[0].totaleVendite).toBe(0);
    expect(result.current.mesi[0].registri).toBe(0);
    expect(result.current.schemaNonDisponibile).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it("espone schemaNonDisponibile quando il server risponde GRAPHQL_VALIDATION_FAILED", async () => {
    const { result } = renderHook(() => useQueryRiepilogoAnnuale({ anno: ANNO }), {
      wrapper: createWrapper([createValidationErrorMock()]),
    });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    expect(result.current.schemaNonDisponibile).toBe(true);
    expect(result.current.hasData).toBe(false);
    expect(result.current.mesi).toHaveLength(0);
  });

  it("NON segnala schemaNonDisponibile per errori diversi dalla validazione", async () => {
    const networkErrorMock: MockedResponse = {
      request: { query: getRiepilogoAnnuale, variables: { anno: ANNO } },
      error: new Error("Network error"),
    };

    const { result } = renderHook(() => useQueryRiepilogoAnnuale({ anno: ANNO }), {
      wrapper: createWrapper([networkErrorMock]),
    });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    expect(result.current.schemaNonDisponibile).toBe(false);
  });

  it("salta la query quando skip è true", () => {
    const { result } = renderHook(() => useQueryRiepilogoAnnuale({ anno: ANNO, skip: true }), {
      wrapper: createWrapper([]),
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.mesi).toHaveLength(0);
    expect(result.current.hasData).toBe(false);
  });
});
