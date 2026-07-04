import { act, renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import { ReactNode } from "react";
import useDashboardData from "../useDashboardData";
import { getRegistriCassa, getRiepilogoAnnuale } from "../../../../../graphql/registroCassa/queries";
import logger from "../../../../../common/logger/logger";
import { ANNO_FIXTURE, attesoMarzo, attesoTotaliAnno, registriFixture } from "../../../../../common/registroCassa/__tests__/fixtures/registriCassaFixtures";

// Subscription controllabile dai test (stesso modulo importato dall'hook)
interface EventoRegistroCassa {
  onRegistroCassaUpdated: {
    registroCassaId: number;
    data: string;
    stato: string;
    totaleVendite: number;
    totaleApertura: number;
    totaleChiusura: number;
    azione: string;
  };
}

let subscriptionValue: EventoRegistroCassa | undefined;

vi.mock("../../../../../graphql/subscriptions/useRegistroCassaSubscription", () => ({
  default: () => ({ data: subscriptionValue, loading: false }),
}));

const creaEvento = (data: string): EventoRegistroCassa => ({
  onRegistroCassaUpdated: {
    registroCassaId: 99,
    data,
    stato: "CLOSED",
    totaleVendite: 100,
    totaleApertura: 0,
    totaleChiusura: 100,
    azione: "UPDATED",
  },
});

const createWrapper = (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => <MockedProvider mocks={mocks}>{children}</MockedProvider>;

const creaMeseServerMock = (anno: number, mese: number, overrides: Record<string, unknown> = {}) => ({
  __typename: "RiepilogoMeseCassa",
  anno,
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

const creaRiepilogoResult = (anno: number, mesi: unknown[]) => ({
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
});

const validationErrorMock = (anno: number): MockedResponse => ({
  request: { query: getRiepilogoAnnuale, variables: { anno } },
  result: {
    errors: [
      new GraphQLError('Cannot query field "riepilogoAnnuale" on type "GestioneCassaQueries".', {
        extensions: { code: "GRAPHQL_VALIDATION_FAILED" },
      }),
    ],
  },
});

const registriCassaMock = (items: unknown[]): MockedResponse => ({
  request: { query: getRegistriCassa },
  variableMatcher: (vars: Record<string, unknown>) =>
    vars?.pageSize === 1000 && typeof vars?.where === "string" && (vars.where as string).includes(`${ANNO_FIXTURE}-01-01`),
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

describe("useDashboardData", () => {
  beforeEach(() => {
    // Solo Date fake: i timer restano reali (compatibilità con waitFor)
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${ANNO_FIXTURE}-07-04T12:00:00`));
    subscriptionValue = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("usa la fonte server quando riepilogoAnnuale risponde (fonte: server)", async () => {
    const resultFn = vi.fn(() =>
      creaRiepilogoResult(ANNO_FIXTURE, [
        creaMeseServerMock(ANNO_FIXTURE, 3, { totaleVendite: 930.7, speseTracciate: 30.3, speseNonTracciate: 35.2, registri: 3, chiusi: 2, bozze: 1 }),
        creaMeseServerMock(ANNO_FIXTURE, 7, { totaleVendite: 200, registri: 1, chiusi: 1 }),
      ])
    );
    const serverMock: MockedResponse = {
      request: { query: getRiepilogoAnnuale, variables: { anno: ANNO_FIXTURE } },
      result: resultFn,
      maxUsageCount: Number.POSITIVE_INFINITY,
    };

    const { result } = renderHook(() => useDashboardData({ anno: ANNO_FIXTURE }), {
      wrapper: createWrapper([serverMock]),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.fonte).toBe("server");
    expect(result.current.riepilogo.fonte).toBe("server");
    expect(result.current.riepilogo.mesi).toHaveLength(12);
    expect(result.current.riepilogo.mesi[2].totaleVendite).toBeCloseTo(930.7, 2);
    expect(result.current.riepilogo.mesi[2].differenza).toBeCloseTo(865.2, 2);
    // Anno corrente (fake: 2026) → meseCorrente = luglio
    expect(result.current.riepilogo.meseCorrente?.mese).toBe(7);
    expect(result.current.meseRiferimento?.mese).toBe(7);
    expect(result.current.error).toBeUndefined();
    // L'adapter NON viene eseguito quando il server risponde (nessun mock getRegistriCassa fornito)
    expect(resultFn).toHaveBeenCalledTimes(1);
  });

  it("attiva l'adapter client su GRAPHQL_VALIDATION_FAILED con le stesse formule normative (fonte: adapter)", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const mocks = [validationErrorMock(ANNO_FIXTURE), registriCassaMock(registriFixture)];

    const { result } = renderHook(() => useDashboardData({ anno: ANNO_FIXTURE }), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.fonte).toBe("adapter");
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.riepilogo.fonte).toBe("adapter");
    expect(result.current.riepilogo.mesi).toHaveLength(12);

    // Stessa shape e stessi valori delle formule normative (fixture condivise)
    const marzo = result.current.riepilogo.mesi[2];
    expect(marzo.totaleVendite).toBeCloseTo(attesoMarzo.totaleVendite, 2);
    expect(marzo.ricavoTracciato).toBeCloseTo(attesoMarzo.ricavoTracciato, 2);
    expect(marzo.ricavoNonTracciato).toBeCloseTo(attesoMarzo.ricavoNonTracciato, 2);
    expect(marzo.totaleSpese).toBeCloseTo(attesoMarzo.totaleSpese, 2);
    expect(marzo.differenza).toBeCloseTo(attesoMarzo.differenza, 2);
    expect(marzo.registri).toBe(attesoMarzo.registri);
    expect(marzo.bozze).toBe(attesoMarzo.bozze);

    expect(result.current.riepilogo.totaliAnno.totaleVendite).toBeCloseTo(attesoTotaliAnno.totaleVendite, 2);
    expect(result.current.riepilogo.totaliAnno.differenza).toBeCloseTo(attesoTotaliAnno.differenza, 2);

    // L'errore di validazione è gestito dall'adapter: non viene propagato
    expect(result.current.error).toBeUndefined();
    // Log diagnostico dell'adapter temporaneo
    expect(warnSpy).toHaveBeenCalled();
  });

  it("esegue il refetch quando l'evento subscription riguarda l'anno selezionato", async () => {
    const resultFn = vi.fn(() => creaRiepilogoResult(ANNO_FIXTURE, [creaMeseServerMock(ANNO_FIXTURE, 7, { totaleVendite: 100, registri: 1 })]));
    const serverMock: MockedResponse = {
      request: { query: getRiepilogoAnnuale, variables: { anno: ANNO_FIXTURE } },
      result: resultFn,
      maxUsageCount: Number.POSITIVE_INFINITY,
    };

    const { result, rerender } = renderHook(() => useDashboardData({ anno: ANNO_FIXTURE }), {
      wrapper: createWrapper([serverMock]),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(resultFn).toHaveBeenCalledTimes(1);

    // Evento dello STESSO anno selezionato → refetch
    subscriptionValue = creaEvento(`${ANNO_FIXTURE}-07-04T00:00:00.000Z`);
    rerender();

    await waitFor(() => {
      expect(resultFn).toHaveBeenCalledTimes(2);
    });
  });

  it("NON esegue il refetch per eventi di un anno diverso", async () => {
    const resultFn = vi.fn(() => creaRiepilogoResult(ANNO_FIXTURE, [creaMeseServerMock(ANNO_FIXTURE, 7, { totaleVendite: 100, registri: 1 })]));
    const serverMock: MockedResponse = {
      request: { query: getRiepilogoAnnuale, variables: { anno: ANNO_FIXTURE } },
      result: resultFn,
      maxUsageCount: Number.POSITIVE_INFINITY,
    };

    const { result, rerender } = renderHook(() => useDashboardData({ anno: ANNO_FIXTURE }), {
      wrapper: createWrapper([serverMock]),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Evento di un ALTRO anno → nessun refetch
    subscriptionValue = creaEvento("2024-12-31T00:00:00.000Z");
    rerender();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(resultFn).toHaveBeenCalledTimes(1);
  });

  it("propaga l'errore di rete (senza attivare l'adapter), lo logga via logger.error e il refetch ripopola i dati", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const networkErrorMock: MockedResponse = {
      request: { query: getRiepilogoAnnuale, variables: { anno: ANNO_FIXTURE } },
      error: new Error("Failed to fetch"),
    };
    const successMock: MockedResponse = {
      request: { query: getRiepilogoAnnuale, variables: { anno: ANNO_FIXTURE } },
      result: creaRiepilogoResult(ANNO_FIXTURE, [creaMeseServerMock(ANNO_FIXTURE, 3, { totaleVendite: 300, registri: 1, chiusi: 1 })]),
    };

    const { result } = renderHook(() => useDashboardData({ anno: ANNO_FIXTURE }), {
      wrapper: createWrapper([networkErrorMock, successMock]),
    });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.loading).toBe(false);
    });

    // Gli errori di rete NON attivano l'adapter (solo GRAPHQL_VALIDATION_FAILED lo fa)
    expect(result.current.fonte).toBe("server");
    // Spec "Gestione errori": l'errore viene loggato tramite il logger dell'app
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("dashboard"), result.current.error);

    // Retry (stesso refetch invocato dal bottone "Riprova" dell'orchestratore)
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).toBeUndefined();
      expect(result.current.riepilogo.mesi).toHaveLength(12);
    });
    expect(result.current.riepilogo.mesi[2].totaleVendite).toBeCloseTo(300, 2);
  });

  it("per un anno passato il mese di riferimento è l'ultimo mese con registri (e meseCorrente è null)", async () => {
    const annoPassato = ANNO_FIXTURE - 1; // 2025
    const serverMock: MockedResponse = {
      request: { query: getRiepilogoAnnuale, variables: { anno: annoPassato } },
      result: creaRiepilogoResult(annoPassato, [
        creaMeseServerMock(annoPassato, 5, { totaleVendite: 500, registri: 2, chiusi: 2 }),
        creaMeseServerMock(annoPassato, 11, { totaleVendite: 1100, registri: 3, chiusi: 3 }),
      ]),
    };

    const { result } = renderHook(() => useDashboardData({ anno: annoPassato }), {
      wrapper: createWrapper([serverMock]),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.meseRiferimento?.mese).toBe(11);
    expect(result.current.meseRiferimento?.totaleVendite).toBeCloseTo(1100, 2);
    expect(result.current.riepilogo.meseCorrente).toBeNull();
  });
});
