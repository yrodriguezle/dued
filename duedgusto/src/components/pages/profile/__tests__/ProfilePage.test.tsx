import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApolloError } from "@apollo/client";

// ── Mock delle dipendenze ──────────────────────────────────────────────

const mockSetTitle = vi.fn();
vi.mock("../../../layout/headerBar/PageTitleContext", () => ({
  default: {
    Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Consumer: () => null,
  },
}));

// Mock PageTitleContext via useContext
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    useContext: (context: unknown) => {
      // Se il context è PageTitleContext, restituisci il mock
      if (context && typeof context === "object" && "Provider" in context) {
        return { title: "Il mio profilo", setTitle: mockSetTitle };
      }
      return (actual as typeof import("react")).useContext(context as React.Context<unknown>);
    },
  };
});

const mockReceiveUtente = vi.fn();
vi.mock("../../../../store/useStore", () => {
  const mockStore = Object.assign(vi.fn(), {
    getState: vi.fn(() => ({})),
  });
  return { default: mockStore };
});

const mockRefetch = vi.fn();
vi.mock("../../../../graphql/utente/useQueryLoggedUser", () => ({
  default: vi.fn(() => ({
    loading: false,
    error: undefined,
    refetch: mockRefetch,
  })),
}));

const mockMutate = vi.fn();
vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual("@apollo/client");
  return {
    ...actual,
    useMutation: vi.fn(() => [mockMutate]),
  };
});

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Import dopo i mock ─────────────────────────────────────────────────

import useStore from "../../../../store/useStore";
import useQueryLoggedUser from "../../../../graphql/utente/useQueryLoggedUser";
import { useMutation } from "@apollo/client";
import ProfilePage from "../ProfilePage";
import { DataRouterTestWrapper } from "../../../../test/helpers/dataRouterTestWrapper";

const mockUseStore = vi.mocked(useStore);
const mockUseQueryLoggedUser = vi.mocked(useQueryLoggedUser);
const mockUseMutation = vi.mocked(useMutation);

// ── Dati di test ───────────────────────────────────────────────────────

const mockUtente: Utente = {
  __typename: "Utente",
  id: 1,
  nomeUtente: "mario.rossi",
  nome: "Mario",
  cognome: "Rossi",
  descrizione: "Descrizione test",
  disabilitato: false,
  ruoloId: 1,
  ruolo: { __typename: "Ruolo", id: 1, nome: "Amministratore", descrizione: "Admin" } as Ruolo,
  menus: [],
};

// ── Helper di rendering ────────────────────────────────────────────────

function setupStore(utente: Utente = mockUtente) {
  mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
    const state = {
      utente,
      receiveUtente: mockReceiveUtente,
      setFormDirty: vi.fn(),
    } as unknown as Store;
    return selector(state);
  });
}

function setupMutation(onCompletedCallback?: (data: unknown) => void) {
  mockUseMutation.mockImplementation((_, options) => {
    const mutateResult = { data: { authentication: { mutateUtente: mockUtente } } };
    const mutate = vi.fn(async () => {
      if (onCompletedCallback) {
        onCompletedCallback(mutateResult.data);
      }
      options?.onCompleted?.(mutateResult.data as never);
      return mutateResult;
    });
    return [mutate, { loading: false, data: undefined, error: undefined } as never];
  });
  return mockUseMutation;
}

function renderProfilePage() {
  return render(
    <DataRouterTestWrapper initialEntries={["/gestionale/profilo"]}>
      <ProfilePage />
    </DataRouterTestWrapper>
  );
}

// ── Test ────────────────────────────────────────────────────────────────

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
    setupMutation();
    mockUseQueryLoggedUser.mockReturnValue({
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    } as never);
  });

  // ── Rendering ──

  it("deve mostrare avatar con iniziali dell'utente", () => {
    renderProfilePage();
    expect(screen.getByText("MR")).toBeInTheDocument();
  });

  it("deve mostrare nome completo, username e ruolo", () => {
    renderProfilePage();
    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getByText("@mario.rossi")).toBeInTheDocument();
    expect(screen.getByText("Amministratore")).toBeInTheDocument();
  });

  it("deve mostrare le sezioni Dati Personali e Cambio Password", () => {
    renderProfilePage();
    expect(screen.getByText("Dati Personali")).toBeInTheDocument();
    expect(screen.getByText("Cambio Password")).toBeInTheDocument();
  });

  // ── Stato loading/errore ──

  it("deve mostrare spinner quando loading e utente nullo", () => {
    setupStore(null);
    mockUseQueryLoggedUser.mockReturnValue({
      loading: true,
      error: undefined,
      refetch: mockRefetch,
    } as never);

    renderProfilePage();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("deve mostrare errore quando error e utente nullo", () => {
    setupStore(null);
    mockUseQueryLoggedUser.mockReturnValue({
      loading: false,
      error: new ApolloError({ errorMessage: "Errore di rete" }),
      refetch: mockRefetch,
    } as never);

    renderProfilePage();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Errore nel caricamento del profilo/)).toBeInTheDocument();
  });

  // ── Titolo pagina ──

  it("deve impostare il titolo della pagina", () => {
    renderProfilePage();
    expect(mockSetTitle).toHaveBeenCalledWith("Il mio profilo");
  });

  // ── Form editabile ──

  it("deve avere i campi nome e cognome editabili", () => {
    renderProfilePage();
    const nomeInput = screen.getByDisplayValue("Mario");
    const cognomeInput = screen.getByDisplayValue("Rossi");
    expect(nomeInput).not.toBeDisabled();
    expect(cognomeInput).not.toBeDisabled();
  });

  it("deve avere il campo nomeUtente disabilitato", () => {
    renderProfilePage();
    const usernameInput = screen.getByLabelText("Nome utente");
    expect(usernameInput).toBeDisabled();
  });

  // ── Toolbar ──

  it("deve mostrare solo il bottone Salva nella toolbar", () => {
    renderProfilePage();
    expect(screen.getByText("Salva")).toBeInTheDocument();
    expect(screen.queryByText("Modifica")).not.toBeInTheDocument();
    expect(screen.queryByText("Nuovo")).not.toBeInTheDocument();
    expect(screen.queryByText("Elimina")).not.toBeInTheDocument();
  });

  // ── Validazione ──

  it("deve mostrare errore di validazione per nome vuoto", async () => {
    const user = userEvent.setup();
    renderProfilePage();

    const nomeInput = screen.getByDisplayValue("Mario");
    await user.clear(nomeInput);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText("Nome è obbligatorio")).toBeInTheDocument();
    });
  });

  it("deve mostrare errore per password mismatch", async () => {
    const user = userEvent.setup();
    renderProfilePage();

    const passwordInput = screen.getByLabelText("Nuova Password");
    const confirmInput = screen.getByLabelText("Conferma Nuova Password");

    await user.type(passwordInput, "password123");
    await user.type(confirmInput, "diversa123");
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText("Le password devono coincidere e avere almeno 6 caratteri")).toBeInTheDocument();
    });
  });

  // ── Submit ──

  it("deve chiamare la mutation al submit con i valori corretti", async () => {
    const user = userEvent.setup();
    const mutate = vi.fn(async () => ({ data: null }));
    mockUseMutation.mockImplementation(() => [mutate, { loading: false, data: undefined, error: undefined } as never]);

    renderProfilePage();

    // Modifica un campo per abilitare il Salva
    const descrizioneInput = screen.getByLabelText("Descrizione");
    await user.clear(descrizioneInput);
    await user.type(descrizioneInput, "Nuova descrizione");

    const salvaButton = screen.getByText("Salva");
    await user.click(salvaButton);

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        variables: {
          utente: expect.objectContaining({
            id: 1,
            nomeUtente: "mario.rossi",
            nome: "Mario",
            cognome: "Rossi",
            descrizione: "Nuova descrizione",
            ruoloId: 1,
          }),
        },
      });
    });
  });

});
