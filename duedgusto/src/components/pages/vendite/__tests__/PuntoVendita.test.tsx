import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { DocumentNode, OperationDefinitionNode } from "graphql";

// `themeStore` legge la preferenza di sistema al momento della **creazione dello store**, cioè
// durante l'import: jsdom non ha `matchMedia`, e senza questo lo store esplode prima che un solo
// test parta. Va in `vi.hoisted` perché deve esistere prima degli import, non dentro un
// `beforeEach`.
vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }),
  });
});

// ── Doppio di Apollo ────────────────────────────────────────────────────────────────────────
//
// Non si usa `MockedProvider` ma si sostituiscono `useQuery` e `useMutation`, come fanno gli
// altri test di pagina di questo progetto. Il motivo qui è più forte del solo precedente: questa
// pagina apre l'ordine **implicitamente** e ciò che va provato è il numero di chiamate a
// `apriOrdine` in una corsa fra due tocchi. Con un doppio le si contano; con la cache di Apollo
// in mezzo si finirebbe a provare la cache.

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual<typeof import("@apollo/client")>("@apollo/client");
  return {
    ...actual,
    useQuery: (documento: DocumentNode, opzioni?: Record<string, unknown>) => useFinestraQuery(documento, opzioni),
    useMutation: (documento: DocumentNode) => useFinestraMutation(documento),
  };
});

vi.mock("../../../../graphql/registroCassa/useQueryRegistroCassa", () => ({
  default: vi.fn(),
}));

vi.mock("../../../../common/toast/showToast", () => ({ default: vi.fn() }));

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));

// ── Import dopo i mock ──────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from "react";
import PuntoVendita from "../PuntoVendita";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";
import useQueryRegistroCassa from "../../../../graphql/registroCassa/useQueryRegistroCassa";

const mockUseQueryRegistroCassa = vi.mocked(useQueryRegistroCassa);

// ── Un database finto che fa ri-renderizzare chi lo legge ───────────────────────────────────

let versione = 0;
const ascoltatori = new Set<() => void>();

function notifica() {
  versione += 1;
  ascoltatori.forEach((ascoltatore) => ascoltatore());
}

function useVersione() {
  return useSyncExternalStore(
    (ascoltatore: () => void) => {
      ascoltatori.add(ascoltatore);
      return () => ascoltatori.delete(ascoltatore);
    },
    () => versione
  );
}

const LISTINO: ProdottoVendibile[] = [
  { prodottoId: 7, codice: "BIR-GANTER-02", nome: "Ganter 0.2", prezzo: 2.5, categoria: "BIRRA", aliquotaIva: 10 },
  { prodottoId: 8, codice: "CAF-ESPRESSO", nome: "Espresso", prezzo: 1.2, categoria: "CAFFETTERIA", aliquotaIva: 10 },
];

/** Il listino visibile alla pagina: lo si svuota nel test del catalogo vuoto. */
let prodotti: ProdottoVendibile[] = LISTINO;

let ordine: Ordine | null = null;
let prossimoIdRiga = 100;

const apriOrdineSpy = vi.fn();
const aggiungiRigaSpy = vi.fn();

function nomeOperazione(documento: DocumentNode): string {
  const definizione = documento.definitions.find((d): d is OperationDefinitionNode => d.kind === "OperationDefinition");
  return definizione?.name?.value ?? "";
}

function useFinestraQuery(documento: DocumentNode, opzioni?: Record<string, unknown>) {
  useVersione();
  const saltata = Boolean(opzioni?.skip);
  const refetch = vi.fn(async () => {
    notifica();
    return { data: undefined };
  });

  const risposta = (data: unknown) => ({ data: saltata ? undefined : data, loading: false, error: undefined, refetch });

  switch (nomeOperazione(documento)) {
    case "GetProdottiVendibili":
      return risposta({ vendite: { prodotti, categorieProdotto: ["BIRRA", "CAFFETTERIA"] } });
    case "GetVenditeDelRegistro":
      return risposta({ vendite: { vendite: [] } });
    case "GetOrdiniAperti":
      return risposta({ vendite: { ordiniAperti: ordine ? [ordine] : [] } });
    case "GetOrdine":
      return risposta({ vendite: { ordine } });
    case "GetOrdiniDelRegistro":
      return risposta({ vendite: { ordiniDelRegistro: [] } });
    default:
      return risposta(undefined);
  }
}

function useFinestraMutation(documento: DocumentNode) {
  const nome = nomeOperazione(documento);

  const esegui = vi.fn(async ({ variables }: { variables?: Record<string, never> } = {}) => {
    if (nome === "ApriOrdine") {
      apriOrdineSpy(variables);
      ordine = {
        ordineId: 55,
        registroCassaId: 3,
        identificativo: "260829-007",
        dataRegistro: "2026-08-29T00:00:00Z",
        numero: 7,
        suffissoSplit: "",
        stato: "APERTO",
        totaleOrdine: 0,
        totaleCorrente: 0,
        righe: [],
        apertoIl: "2026-08-29T18:00:00Z",
      };
      notifica();
      return { data: { vendite: { apriOrdine: ordine } } };
    }

    if (nome === "AggiungiRigaOrdine") {
      aggiungiRigaSpy(variables);
      const prodotto = LISTINO.find((p) => p.prodottoId === variables?.["prodottoId"]);
      const riga: RigaOrdine = {
        rigaOrdineId: (prossimoIdRiga += 1),
        ordineId: 55,
        prodottoId: prodotto?.prodottoId ?? 0,
        quantita: 1,
        prezzoUnitario: prodotto?.prezzo ?? 0,
        prezzoTotale: prodotto?.prezzo ?? 0,
        aliquotaIva: 10,
        dataOra: "2026-08-29T18:00:00Z",
        prodotto: prodotto ? { prodottoId: prodotto.prodottoId, codice: prodotto.codice, nome: prodotto.nome } : null,
      };
      const righe = [...(ordine?.righe ?? []), riga];
      ordine = { ...(ordine as Ordine), righe, totaleCorrente: righe.reduce((somma, r) => somma + r.prezzoTotale, 0) };
      notifica();
      return { data: { vendite: { aggiungiRigaOrdine: riga } } };
    }

    return { data: undefined };
  });

  return [esegui, { loading: false, data: undefined, error: undefined }];
}

const REGISTRO = { id: 3, data: "2026-08-29", stato: "DRAFT", totaleVendite: 0 } as unknown as RegistroCassa;

function renderPuntoVendita() {
  return render(
    <PageTitleContext.Provider value={{ title: "", setTitle: vi.fn() }}>
      <PuntoVendita />
    </PageTitleContext.Provider>
  );
}

describe("PuntoVendita", () => {
  beforeEach(() => {
    ordine = null;
    prodotti = LISTINO;
    prossimoIdRiga = 100;
    versione = 0;
    apriOrdineSpy.mockReset();
    aggiungiRigaSpy.mockReset();
    mockUseQueryRegistroCassa.mockReturnValue({
      registroCassa: REGISTRO,
      error: undefined,
      loading: false,
      refetch: vi.fn(),
    } as never);
  });

  it("senza cassa aperta non mostra la griglia e manda ad aprirla", () => {
    // 🔴 Il caso si gestisce PRIMA della griglia: gli ordini si agganciano al registro del
    //    giorno, e lasciar battere per poi rifiutare farebbe perdere l'ordinazione.
    mockUseQueryRegistroCassa.mockReturnValue({ registroCassa: null, error: undefined, loading: false, refetch: vi.fn() } as never);
    renderPuntoVendita();

    expect(screen.getByText("La cassa di oggi non è ancora aperta")).toBeInTheDocument();
    expect(screen.queryByText("Ganter 0.2")).not.toBeInTheDocument();
  });

  it("regge un listino vuoto invece di sparire", () => {
    // In produzione la tabella dei prodotti può essere ancora vuota: la pagina deve dirlo e
    // restare in piedi, non presentare una griglia vuota senza spiegazione.
    prodotti = [];
    renderPuntoVendita();

    expect(screen.getByText(/Nessun prodotto attivo corrisponde/)).toBeInTheDocument();
    expect(screen.getByText("Nessun ordine aperto")).toBeInTheDocument();
  });

  it("parte senza alcun ordine aperto", () => {
    renderPuntoVendita();

    expect(screen.getByText("Nessun ordine aperto")).toBeInTheDocument();
    expect(screen.getByText("Tocca un prodotto per iniziare")).toBeInTheDocument();
  });

  it("il tocco su un prodotto aggiunge una voce senza chiedere il metodo di pagamento", async () => {
    // 🔴 È il senso del change: al bancone non si sa come pagheranno finché non arrivano alla
    //    cassa. Il foglio del metodo non deve aprirsi qui.
    renderPuntoVendita();

    await act(async () => {
      screen.getByText("Ganter 0.2").click();
    });

    await waitFor(() => expect(aggiungiRigaSpy).toHaveBeenCalledTimes(1));
    expect(aggiungiRigaSpy).toHaveBeenCalledWith({ ordineId: 55, prodottoId: 7, quantita: 1 });
    expect(screen.queryByText("Elettronico")).not.toBeInTheDocument();
    expect(screen.queryByText("Contante tracciato")).not.toBeInTheDocument();
  });

  it("la barra mostra il totale corrente e l'identificativo dell'ordine", async () => {
    renderPuntoVendita();

    await act(async () => {
      screen.getByText("Ganter 0.2").click();
    });
    await act(async () => {
      screen.getByText("Espresso").click();
    });

    await waitFor(() => expect(screen.getByText("3,70 €")).toBeInTheDocument());
    expect(screen.getByText(/Ordine 260829-007 · 2 voci/)).toBeInTheDocument();
  });

  it("due tocchi ravvicinati non aprono due ordini", async () => {
    // 🔴 L'apertura è implicita al primo tocco e la risposta non è istantanea: senza la promessa
    //    condivisa nascerebbero due ordini, il secondo con dentro una sola voce, e nessuno se ne
    //    accorgerebbe fino alla cassa.
    renderPuntoVendita();

    await act(async () => {
      screen.getByText("Ganter 0.2").click();
      screen.getByText("Ganter 0.2").click();
    });

    await waitFor(() => expect(aggiungiRigaSpy).toHaveBeenCalledTimes(2));
    expect(apriOrdineSpy).toHaveBeenCalledTimes(1);
  });

  it("con un ordine aperto offre le due uscite: annulla e chiudi", async () => {
    renderPuntoVendita();

    await act(async () => {
      screen.getByText("Ganter 0.2").click();
    });

    await waitFor(() => expect(screen.getByText("Chiudi ordine")).toBeInTheDocument());
    // 🔴 «Annulla ordine», non «storna»: qui l'ordine è ancora aperto e non ha mosso un
    //    centesimo. Lo storno è un altro gesto, su un incasso già dichiarato.
    expect(screen.getByText("Annulla ordine")).toBeInTheDocument();
    expect(screen.queryByText("Storna")).not.toBeInTheDocument();
  });
});
