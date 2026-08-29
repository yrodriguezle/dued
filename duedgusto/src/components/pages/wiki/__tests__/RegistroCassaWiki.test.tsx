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

/**
 * Deroga al timeout di default (5 s per test), limitata a questo file.
 *
 * Questa voce della wiki è una pagina di documentazione, non uno schermo di
 * lavoro: ~860 elementi, di cui 390 sono i nodi dei quattro diagrammi SVG
 * scritti a mano, più una settantina di fogli di stile iniettati da emotion.
 * Renderla costa 250-780 ms, e ogni query per ruolo su un DOM appena montato ne
 * costa altri ~400, perché jsdom deve risolvere il ruolo elemento per elemento
 * e calcolare gli stili; una query che deve confrontare il nome accessibile di
 * tutti i 18 titoli della pagina arriva da sola a ~800 ms. Isolato, il caso più
 * pesante sta sui 2 s; dentro la suite intera (115 file e 923 test in parallelo
 * su 6 core) è stato misurato a 2,97 s, e in una corsa sfortunata il caso delle
 * tabelle aveva superato i 5,2 s, facendo fallire la suite a intermittenza.
 *
 * Il costo è reale: rendere questa pagina cinque volte è ciò che il file deve
 * fare. Quindici secondi lasciano circa 6 volte il caso peggiore misurato.
 * Se un giorno un caso di questo file sforasse anche questo margine, la risposta
 * non è alzare ancora il numero: vorrebbe dire che la voce è cresciuta al punto
 * da non poter più essere renderizzata per intero a ogni caso, e andrebbe
 * testata a pezzi (WikiTable, WikiLayout e i singoli diagrammi sono componenti
 * separati proprio per questo).
 */
const TIMEOUT_PAGINA_WIKI = 15_000;

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

describe("RegistroCassaWiki", { timeout: TIMEOUT_PAGINA_WIKI }, () => {
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

    // Il getByRole resta perché qui l'asserzione è proprio sul nome accessibile:
    // è l'aria-label di WikiTable che distingue questa tabella dalle altre quattro.
    const tabella = screen.getByRole("table", { name: "Tabelle del dominio cassa" });

    // Righe e celle, invece, si leggono dal DOM: dentro una <table> il loro ruolo
    // è già garantito dal markup, quindi chiederlo a getAllByRole non aggiunge
    // nessuna verifica — costa e basta. Ogni query per ruolo risolve il ruolo di
    // ogni elemento candidato contro l'intera mappa ARIA: le 17 query "row" e
    // "cell" che c'erano prima costavano 1,5 s dei 2,2 s del caso, ed erano la
    // ragione per cui questo test sforava il timeout quando la suite gira in
    // parallelo. La stessa lettura via querySelectorAll costa 3 ms.
    //
    // La prima colonna porta il nome della tabella: è lì che va cercato,
    // perché gli stessi nomi ricompaiono nella colonna "Legata a".
    const nomiTabelle = Array.from(tabella.querySelectorAll<HTMLTableRowElement>("tbody tr")).map((riga) => riga.cells[0].textContent);

    expect(nomiTabelle).toContain("RegistriCassa");
    expect(nomiTabelle).toContain("RegistriCassaMensili");
    expect(nomiTabelle).toContain("PagamentiFornitori");
    expect(nomiTabelle).toContain("RegistriCassaIva");
  });
});
