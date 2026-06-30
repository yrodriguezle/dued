import { renderHook, waitFor } from "@testing-library/react";
import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { ReactNode } from "react";
import useQueryDashboardKPIs from "../useQueryDashboardKPIs";
import { getDashboardKPIs } from "../queries";

const createWrapper = (mocks: MockedResponse[]) =>
  ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks}>{children}</MockedProvider>
  );

const mockKPIs = {
  __typename: "DashboardKPIs",
  venditeOggi: 1500.50,
  differenzaOggi: -5.20,
  venditeMese: 35000.00,
  mediaMese: 1250.00,
  trendSettimana: 8500.75,
};

describe("useQueryDashboardKPIs", () => {
  it("dovrebbe restituire i dati KPI aggregati", async () => {
    const mock: MockedResponse = {
      request: { query: getDashboardKPIs },
      variableMatcher: () => true,
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementQueries",
            dashboardKPIs: mockKPIs,
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(() => useQueryDashboardKPIs(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.kpis).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.kpis).toBeDefined();
    expect(result.current.kpis?.venditeOggi).toBe(1500.50);
    expect(result.current.kpis?.venditeMese).toBe(35000.00);
    expect(result.current.error).toBeUndefined();
  });

  it("dovrebbe gestire dati null/vuoti", async () => {
    const mock: MockedResponse = {
      request: { query: getDashboardKPIs },
      variableMatcher: () => true,
      result: {
        data: {
          gestioneCassa: {
            __typename: "CashManagementQueries",
            dashboardKPIs: null,
          },
        },
      },
    };

    const wrapper = createWrapper([mock]);

    const { result } = renderHook(() => useQueryDashboardKPIs(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.kpis).toBeNull();
  });

  it("dovrebbe gestire lo stato di errore", async () => {
    const errorMock: MockedResponse = {
      request: { query: getDashboardKPIs },
      variableMatcher: () => true,
      error: new Error("Errore nel caricamento KPI"),
    };

    const wrapper = createWrapper([errorMock]);

    const { result } = renderHook(() => useQueryDashboardKPIs(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.kpis).toBeNull();
  });
});
