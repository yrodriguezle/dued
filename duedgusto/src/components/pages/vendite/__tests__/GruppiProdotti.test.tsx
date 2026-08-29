import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { DocumentNode, OperationDefinitionNode } from "graphql";

vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }),
  });
});

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual<typeof import("@apollo/client")>("@apollo/client");
  return {
    ...actual,
    useQuery: (documento: DocumentNode) => finestraQuery(documento),
    useMutation: (documento: DocumentNode) => finestraMutation(documento),
  };
});

vi.mock("../../../../common/toast/showToast", () => ({ default: vi.fn() }));

import GruppiProdotti from "../GruppiProdotti";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";

/**
 * La pagina di composizione dei gruppi.
 *
 * <p>🔴 Il caso che questi test tengono fermo è **quello che in produzione è fallito**: un gruppo
 * «Spritz» creato e salvato due volte con zero membri dentro. La composizione deve essere un
 * gesto visibile — il prodotto si sposta da una lista all'altra — e non una spunta nascosta in
 * una colonna di una griglia dati.</p>
 *
 * <p>⚠️ L'ordine dei membri **si deriva dalla posizione** nella lista, non da un numero scritto
 * a mano: è la ragione per cui il riordino qui si prova insieme al salvataggio, non a parte.</p>
 */

// ── I doppi ──────────────────────────────────────────────────────────────────────────────────

function prodotto(prodottoId: number, nome: string, categoria: string, prezzo: number): ProdottoVendibile {
  return {
    prodottoId,
    codice: `P${String(prodottoId).padStart(3, "0")}`,
    nome,
    prezzo,
    categoria,
    aliquotaIva: 10,
    ordinamento: 0,
    colore: null,
  } as ProdottoVendibile;
}

const APEROL = prodotto(1, "Aperol Spritz", "APERITIVO", 4.5);
const CAMPARI = prodotto(2, "Campari Spritz", "APERITIVO", 4.5);
const HUGO = prodotto(3, "Hugo", "APERITIVO", 5);
const CAFFE = prodotto(4, "Caffè", "CAFFETTERIA", 1.2);

const PRODOTTI = [APEROL, CAMPARI, HUGO, CAFFE];

/** «Spritz» con due varianti dentro: è il gruppo che in produzione era rimasto vuoto. */
const SPRITZ: GruppoProdotti = {
  gruppoProdottiId: 1,
  codice: "APE-GRUPPO",
  nome: "Spritz",
  colore: null,
  ordinamento: 0,
  attivo: true,
  prezzoMinimo: 4.5,
  prezzoUniforme: true,
  membri: [
    { prodottoId: 1, ordinamento: 1, prodotto: APEROL },
    { prodottoId: 2, ordinamento: 2, prodotto: CAMPARI },
  ],
};

let gruppi: GruppoProdotti[] = [];
const salvaSpy = vi.fn();
const eliminaSpy = vi.fn();
let gruppoRestituito: GruppoProdotti | null = null;

function nomeOperazione(documento: DocumentNode): string {
  const definizione = documento.definitions.find((d): d is OperationDefinitionNode => d.kind === "OperationDefinition");
  return definizione?.name?.value ?? "";
}

function finestraQuery(documento: DocumentNode) {
  const refetch = vi.fn(async () => ({ data: undefined }));
  const nome = nomeOperazione(documento);
  if (nome === "GetGruppiProdotti") {
    return { data: { vendite: { gruppiProdotti: gruppi, prodottiNonRaggruppati: [] } }, loading: false, error: undefined, refetch };
  }
  if (nome === "GetProdottiVendibili") {
    return {
      data: { vendite: { prodotti: PRODOTTI, categorieProdotto: ["APERITIVO", "CAFFETTERIA"] } },
      loading: false,
      error: undefined,
      refetch,
    };
  }
  return { data: undefined, loading: false, error: undefined, refetch };
}

function finestraMutation(documento: DocumentNode) {
  const nome = nomeOperazione(documento);
  const esegui = vi.fn(async ({ variables }: { variables?: Record<string, unknown> } = {}) => {
    if (nome === "MutateGruppoProdotti") {
      salvaSpy(variables);
      return { data: { vendite: { mutateGruppoProdotti: gruppoRestituito } } };
    }
    if (nome === "EliminaGruppoProdotti") {
      eliminaSpy(variables);
    }
    return { data: undefined };
  });
  return [esegui, { loading: false, data: undefined, error: undefined }];
}

function renderPagina() {
  return render(
    <PageTitleContext.Provider value={{ title: "", setTitle: vi.fn() }}>
      <GruppiProdotti />
    </PageTitleContext.Provider>
  );
}

/** Il pannello dei membri, per non confondere «Aperol» dentro il gruppo con «Aperol» a listino. */
function pannelloMembri() {
  return screen.getByRole("region", { name: /nel gruppo/i });
}

/** Il pannello del listino: i prodotti ancora da aggiungere. */
function pannelloListino() {
  return screen.getByRole("region", { name: /listino/i });
}

function membriDelPannello(): string[] {
  return within(pannelloMembri())
    .getAllByRole("listitem")
    .map((riga) => riga.textContent ?? "");
}

// ── Le prove ─────────────────────────────────────────────────────────────────────────────────

describe("la pagina Gruppi di prodotti", () => {
  beforeEach(() => {
    gruppi = [SPRITZ];
    gruppoRestituito = null;
    salvaSpy.mockReset();
    eliminaSpy.mockReset();
  });

  it("apre un gruppo e mostra i suoi membri separati dal listino", () => {
    renderPagina();

    fireEvent.click(screen.getByRole("button", { name: /Spritz/ }));

    expect(within(pannelloMembri()).getByText("Aperol Spritz")).toBeInTheDocument();
    expect(within(pannelloMembri()).getByText("Campari Spritz")).toBeInTheDocument();

    // ⚠️ Chi è già dentro NON deve ricomparire a listino: aggiungerlo due volte violerebbe la
    //    chiave composita e il server risponderebbe con un errore invece che con un no-op.
    expect(within(pannelloListino()).queryByText("Aperol Spritz")).not.toBeInTheDocument();
    expect(within(pannelloListino()).getByText("Hugo")).toBeInTheDocument();
  });

  it("aggiunge un prodotto al gruppo con un solo gesto, e quello si sposta a vista", () => {
    renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /Spritz/ }));

    fireEvent.click(within(pannelloListino()).getByRole("button", { name: /Aggiungi Hugo/i }));

    expect(within(pannelloMembri()).getByText("Hugo")).toBeInTheDocument();
    expect(within(pannelloListino()).queryByText("Hugo")).not.toBeInTheDocument();
  });

  it("toglie un membro e lo rimanda a listino", () => {
    renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /Spritz/ }));

    fireEvent.click(within(pannelloMembri()).getByRole("button", { name: /Togli Campari Spritz/i }));

    expect(within(pannelloMembri()).queryByText("Campari Spritz")).not.toBeInTheDocument();
    expect(within(pannelloListino()).getByText("Campari Spritz")).toBeInTheDocument();
  });

  it("filtra il listino con la ricerca, senza toccare i membri", () => {
    renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /Spritz/ }));

    fireEvent.change(screen.getByLabelText(/Cerca un prodotto/i), { target: { value: "hug" } });

    expect(within(pannelloListino()).getByText("Hugo")).toBeInTheDocument();
    expect(within(pannelloListino()).queryByText("Caffè")).not.toBeInTheDocument();
    expect(within(pannelloMembri()).getByText("Aperol Spritz")).toBeInTheDocument();
  });

  it("salva i membri con l'ordinamento preso dalla posizione, non da un numero scritto a mano", async () => {
    renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /Spritz/ }));
    fireEvent.click(within(pannelloListino()).getByRole("button", { name: /Aggiungi Hugo/i }));

    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(salvaSpy).toHaveBeenCalled());
    expect(salvaSpy.mock.calls[0][0].gruppo.membri).toEqual([
      { prodottoId: 1, ordinamento: 1 },
      { prodottoId: 2, ordinamento: 2 },
      { prodottoId: 3, ordinamento: 3 },
    ]);
  });

  it("riordina i membri con le frecce e salva il nuovo ordine", async () => {
    renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /Spritz/ }));

    fireEvent.click(within(pannelloMembri()).getByRole("button", { name: /Sposta su Campari Spritz/i }));

    expect(membriDelPannello()[0]).toContain("Campari Spritz");

    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(salvaSpy).toHaveBeenCalled());
    expect(salvaSpy.mock.calls[0][0].gruppo.membri).toEqual([
      { prodottoId: 2, ordinamento: 1 },
      { prodottoId: 1, ordinamento: 2 },
    ]);
  });

  it("dopo il salvataggio tiene il gruppo aperto invece di svuotare la pagina", async () => {
    gruppoRestituito = SPRITZ;
    renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /Spritz/ }));

    fireEvent.click(screen.getByRole("button", { name: "Salva" }));

    await waitFor(() => expect(salvaSpy).toHaveBeenCalled());
    // 🔴 È il difetto che ha fatto credere che il salvataggio non funzionasse: il form si
    //    svuotava, e il gruppo appena salvato spariva dagli occhi di chi lo stava componendo.
    expect(screen.getByLabelText(/Nome del gruppo/i)).toHaveValue("Spritz");
    expect(within(pannelloMembri()).getByText("Aperol Spritz")).toBeInTheDocument();
  });

  it("genera il codice dal nome per un gruppo nuovo, senza costringere a inventarlo", () => {
    renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /Nuovo gruppo/i }));

    fireEvent.change(screen.getByLabelText(/Nome del gruppo/i), { target: { value: "Caffè speciali" } });

    expect(screen.getByLabelText(/Codice/i)).toHaveValue("CAFFE-SPECIALI");
  });

  it("non lascia salvare un gruppo senza nome", () => {
    renderPagina();
    fireEvent.click(screen.getByRole("button", { name: /Nuovo gruppo/i }));

    expect(screen.getByRole("button", { name: "Salva" })).toBeDisabled();
  });

  it("dice quante varianti ha ogni gruppo nell'elenco a sinistra", () => {
    renderPagina();

    expect(screen.getByRole("button", { name: /Spritz/ })).toHaveTextContent(/2 varianti/i);
  });
});
