import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mock delle dipendenze (pattern FatturaAcquistoDetails.test.tsx: vi.mock, NON MockedProvider) ──

// useLazyQuery (fatture/DDT non pagati): nessun dato, solo spy stabile su ogni chiamata.
vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useLazyQuery: vi.fn(() => [vi.fn(), { loading: false, data: undefined, error: undefined }]),
  };
});

// La searchbox fornitore pulls in AG Grid/Apollo: la sostituiamo con uno stub.
vi.mock("../../../common/form/searchbox/FormikSearchbox", () => ({
  default: () => <div data-testid="fornitore-searchbox-stub" />,
}));

vi.mock("../../../../common/toast/showToast", () => ({
  default: vi.fn(),
}));

// ── Import dopo i mock ─────────────────────────────────────────────────

import PagamentoFornitoreDialog from "../PagamentoFornitoreDialog";

// initialData con fornitore + importo → abilita il pulsante di conferma (in modalità
// modifica) senza dover pilotare searchbox/importo dalla UI.
function makeInitialData(overrides: Partial<Spese> = {}): Spese {
  return {
    description: "Pagamento ACME",
    amount: 100,
    isPagamentoFornitore: true,
    fornitoreId: 5,
    documentType: "DDT",
    ddtNumber: "DDT-1",
    paymentMethod: "Bonifico",
    pagamentoId: 77,
    ...overrides,
  };
}

// La select MUI "Categoria" non ha associazione label→combobox (nessun htmlFor),
// quindi la localizziamo tramite la FormControl che contiene l'etichetta.
function getCategoriaSelect(): HTMLElement {
  const label = screen.getByText("Categoria", { selector: "label" });
  const formControl = label.closest(".MuiFormControl-root") as HTMLElement;
  return within(formControl).getByRole("combobox");
}

// ── Test ────────────────────────────────────────────────────────────────

describe("PagamentoFornitoreDialog — select Categoria", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra la select Categoria con le 4 categorie + l'opzione vuota", async () => {
    const user = userEvent.setup();
    render(
      <PagamentoFornitoreDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const categoriaSelect = getCategoriaSelect();
    expect(categoriaSelect).toBeInTheDocument();

    await user.click(categoriaSelect);
    const listbox = within(screen.getByRole("listbox"));
    expect(listbox.getByRole("option", { name: "Nessuna" })).toBeInTheDocument();
    expect(listbox.getByRole("option", { name: "Affitto" })).toBeInTheDocument();
    expect(listbox.getByRole("option", { name: "Utenze" })).toBeInTheDocument();
    expect(listbox.getByRole("option", { name: "Stipendi" })).toBeInTheDocument();
    expect(listbox.getByRole("option", { name: "Altro" })).toBeInTheDocument();
  });

  it("in modalità modifica pre-riempie la Categoria da initialData", () => {
    render(
      <PagamentoFornitoreDialog
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialData={makeInitialData({ categoria: "Stipendi" })}
      />
    );

    const categoriaSelect = getCategoriaSelect();
    expect(categoriaSelect).toHaveTextContent("Stipendi");
  });

  it("emette la Categoria selezionata in onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PagamentoFornitoreDialog
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        initialData={makeInitialData()}
      />
    );

    await user.click(getCategoriaSelect());
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Utenze" }));

    await user.click(screen.getByRole("button", { name: "Aggiorna" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ categoria: "Utenze" }));
  });

  it("senza Categoria emette categoria undefined (spesa tracciata non classificata)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PagamentoFornitoreDialog
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        initialData={makeInitialData()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Aggiorna" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ categoria: undefined }));
  });
});
