import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("../../../../store/useStore", () => {
  const mockStore = Object.assign(vi.fn(), {
    getState: vi.fn(() => ({})),
  });
  return { default: mockStore };
});

import useStore from "../../../../store/useStore";
import RegistroCassaWiki from "../RegistroCassaWiki";

const mockUseStore = vi.mocked(useStore);

function setupStore({ amministratore }: { amministratore: boolean }) {
  mockUseStore.mockImplementation((selector: (state: Store) => unknown) => {
    const state = {
      utente: {
        id: 1,
        nomeUtente: "mario.rossi",
        ruolo: { id: 1, nome: "Gestore", descrizione: "", amministratore },
      },
    } as unknown as Store;
    return selector(state);
  });
}

describe("RegistroCassaWiki", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra la voce a un utente con ruolo amministratore", () => {
    setupStore({ amministratore: true });
    render(<RegistroCassaWiki />);

    expect(screen.getByRole("heading", { name: "Registro Cassa e Chiusura Mensile", level: 5 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Le quattro formule della quadratura/ })).toBeInTheDocument();
  });

  it("nega l'accesso a un utente senza flag amministratore", () => {
    setupStore({ amministratore: false });
    render(<RegistroCassaWiki />);

    expect(screen.getByText(/riservata ai ruoli con privilegi di amministratore/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Le quattro formule della quadratura/ })).not.toBeInTheDocument();
  });

  it("disegna i quattro diagrammi", () => {
    setupStore({ amministratore: true });
    render(<RegistroCassaWiki />);

    expect(screen.getByRole("img", { name: /Diagramma 1 — Il giorno/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Diagramma 2 — Il mese/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Diagramma 3 — Chi scrive/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Diagramma 4 — Gli stati/ })).toBeInTheDocument();
  });

  it("ogni voce dell'indice punta a una sezione che esiste", () => {
    setupStore({ amministratore: true });
    const { container } = render(<RegistroCassaWiki />);

    const indice = screen.getByRole("navigation", { name: "Indice della voce" });
    const ancore = within(indice).getAllByRole("link");

    expect(ancore.length).toBeGreaterThan(0);
    ancore.forEach((ancora) => {
      const id = ancora.getAttribute("href")?.replace("#", "");
      expect(container.querySelector(`section#${id}`)).not.toBeNull();
    });
  });

  it("elenca le tabelle del dominio", () => {
    setupStore({ amministratore: true });
    render(<RegistroCassaWiki />);

    const tabella = screen.getByRole("table", { name: "Tabelle del dominio cassa" });
    // La prima colonna porta il nome della tabella: è lì che va cercato,
    // perché gli stessi nomi ricompaiono nella colonna "Legata a".
    const nomiTabelle = within(tabella)
      .getAllByRole("row")
      .slice(1)
      .map((riga) => within(riga).getAllByRole("cell")[0].textContent);

    expect(nomiTabelle).toContain("RegistriCassa");
    expect(nomiTabelle).toContain("RegistriCassaMensili");
    expect(nomiTabelle).toContain("PagamentiFornitori");
    expect(nomiTabelle).toContain("RegistriCassaIva");
  });
});
