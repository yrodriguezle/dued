import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock delle dipendenze (pattern ProfilePage.test.tsx: vi.mock dei moduli hook, NON MockedProvider) ──

vi.mock("../../../../store/useStore", () => {
  const mockStore = Object.assign(vi.fn(), {
    getState: vi.fn(() => ({})),
  });
  return { default: mockStore };
});

const mockLoadInvoice = vi.fn(async () => ({ data: undefined }));
const mockMutate = vi.fn(async () => ({ data: undefined }));
vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useLazyQuery: vi.fn(() => [mockLoadInvoice, { loading: false, data: undefined, error: undefined }]),
    useMutation: vi.fn(() => [mockMutate, { loading: false, data: undefined, error: undefined }]),
  };
});

// Stub del form (contiene searchbox e griglie AG Grid) e del dialog DDT
vi.mock("../FatturaAcquistoForm", () => ({
  default: () => <div data-testid="fattura-acquisto-form" />,
}));
vi.mock("../PrelevaDdtDialog", () => ({
  default: () => null,
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// ── Import dopo i mock ─────────────────────────────────────────────────

import useStore from "../../../../store/useStore";
import FatturaAcquistoDetails from "../FatturaAcquistoDetails";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import { DataRouterTestWrapper } from "../../../../test/helpers/dataRouterTestWrapper";

const mockUseStore = vi.mocked(useStore);
const mockSetTitle = vi.fn();

// ── Helper ─────────────────────────────────────────────────────────────

function setupStore() {
  mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
    const state = {
      setConfirmValues: vi.fn(),
      setFormDirty: vi.fn(),
    } as unknown as Store;
    return selector(state);
  });
}

function renderFatturaAcquistoDetails(search = "") {
  return render(
    <PageTitleContext.Provider value={{ title: "Dettaglio Fattura Acquisto", setTitle: mockSetTitle }}>
      <DataRouterTestWrapper initialEntries={[`/gestionale/fatture-acquisto-details${search}`]}>
        <FatturaAcquistoDetails />
      </DataRouterTestWrapper>
    </PageTitleContext.Provider>
  );
}

// ── Test ────────────────────────────────────────────────────────────────

describe("FatturaAcquistoDetails (smoke)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it("monta senza errori e mostra gli elementi chiave del form", () => {
    renderFatturaAcquistoDetails();

    // Titolo della vista
    expect(screen.getByText("Dettaglio Fattura Acquisto")).toBeInTheDocument();
    // Toolbar form standard
    expect(screen.getByText("Modifica")).toBeInTheDocument();
    expect(screen.getByText("Salva")).toBeInTheDocument();
    expect(screen.getByText("Nuovo")).toBeInTheDocument();
    expect(screen.getByText("Elimina")).toBeInTheDocument();
    // Form (stub) montato
    expect(screen.getByTestId("fattura-acquisto-form")).toBeInTheDocument();
  });

  it("imposta il titolo della pagina", () => {
    renderFatturaAcquistoDetails();
    expect(mockSetTitle).toHaveBeenCalledWith("Dettaglio Fattura Acquisto");
  });

  it("carica la fattura quando l'URL contiene invoiceId", () => {
    renderFatturaAcquistoDetails("?invoiceId=7");
    expect(mockLoadInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { fatturaId: 7 } })
    );
  });
});
