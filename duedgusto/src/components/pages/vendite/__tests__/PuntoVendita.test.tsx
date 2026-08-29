import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// `useLocation` serve alla ripresa di un ordine scelto nella pagina «Ordini»: arriva nello
// `state` della navigazione. Il doppio restituisce uno stato vuoto — il caso normale, in cui si
// entra nel punto vendita dalla barra e non da un ordine scelto altrove.
const navigateSpy = vi.fn();
let statoNavigazione: unknown = null;

vi.mock("react-router", () => ({
  useNavigate: () => navigateSpy,
  useLocation: () => ({ pathname: "/gestionale/cassa/vendita", state: statoNavigazione, search: "", hash: "", key: "test" }),
}));

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

/** I gruppi visibili alla pagina. Vuoto = nessun gruppo, cioè la griglia piatta di prima. */
let gruppi: GruppoProdotti[] = [];

/**
 * 🔴 Gli ordini aperti sono **più d'uno**, e il doppio deve saperlo reggere.
 *
 * Finché ne teneva uno solo era impossibile provare il caso vero del bancone — due clienti
 * insieme — e il test sarebbe passato anche con una pagina che sovrascrive il primo ordine con
 * il secondo, che è esattamente il guasto da escludere.
 */
let ordini: Ordine[] = [];
let ordine: Ordine | null = null;
let prossimoIdOrdine = 55;
let prossimoNumeroOrdine = 7;
let prossimoIdRiga = 100;

/** L'ordine con quell'id, se il doppio lo conosce. */
function trovaOrdine(id: unknown): Ordine | null {
  return ordini.find((o) => o.ordineId === id) ?? null;
}

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
      return risposta({ vendite: { ordiniAperti: ordini.filter((o) => o.stato === "APERTO") } });
    case "GetOrdine": {
      // L'id conta: una pagina che chiedesse sempre lo stesso ordine passerebbe il test degli
      // ordini in parallelo senza averli mai davvero distinti.
      const variabili = opzioni?.["variables"] as Record<string, unknown> | undefined;
      return risposta({ vendite: { ordine: trovaOrdine(variabili?.["id"]) } });
    }
    case "GetGruppiProdotti": {
      // ⚠️ I non raggruppati li calcola il server: qui si riproduce la stessa regola, altrimenti
      //    il doppio proverebbe una griglia che il backend non produrrebbe mai.
      const raggruppati = new Set(gruppi.flatMap((g) => g.membri.map((m) => m.prodottoId)));
      return risposta({
        vendite: {
          gruppiProdotti: gruppi,
          prodottiNonRaggruppati: prodotti.filter((p) => !raggruppati.has(p.prodottoId)),
        },
      });
    }
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
      const numero = prossimoNumeroOrdine;
      ordine = {
        ordineId: prossimoIdOrdine,
        registroCassaId: 3,
        identificativo: `260829-${String(numero).padStart(3, "0")}`,
        dataRegistro: "2026-08-29T00:00:00Z",
        numero,
        suffissoSplit: "",
        stato: "APERTO",
        totaleOrdine: 0,
        totaleCorrente: 0,
        righe: [],
        apertoIl: "2026-08-29T18:00:00Z",
      };
      prossimoIdOrdine += 1;
      prossimoNumeroOrdine += 1;
      ordini = [...ordini, ordine];
      notifica();
      return { data: { vendite: { apriOrdine: ordine } } };
    }

    if (nome === "AggiungiRigaOrdine") {
      aggiungiRigaSpy(variables);
      const prodotto = LISTINO.find((p) => p.prodottoId === variables?.["prodottoId"]);
      // ⚠️ L'ordine di destinazione è quello che la pagina indica, non l'ultimo aperto: è la
      //    differenza fra provare gli ordini in parallelo e provare una variabile globale.
      const destinazione = trovaOrdine(variables?.["ordineId"]) ?? ordine;
      const riga: RigaOrdine = {
        rigaOrdineId: (prossimoIdRiga += 1),
        ordineId: destinazione?.ordineId ?? 0,
        prodottoId: prodotto?.prodottoId ?? 0,
        quantita: 1,
        prezzoUnitario: prodotto?.prezzo ?? 0,
        prezzoTotale: prodotto?.prezzo ?? 0,
        aliquotaIva: 10,
        dataOra: "2026-08-29T18:00:00Z",
        prodotto: prodotto ? { prodottoId: prodotto.prodottoId, codice: prodotto.codice, nome: prodotto.nome } : null,
      };
      const righe = [...(destinazione?.righe ?? []), riga];
      const aggiornato = { ...(destinazione as Ordine), righe, totaleCorrente: righe.reduce((somma, r) => somma + r.prezzoTotale, 0) };
      ordini = ordini.map((o) => (o.ordineId === aggiornato.ordineId ? aggiornato : o));
      ordine = aggiornato;
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
    ordini = [];
    gruppi = [];
    prossimoIdOrdine = 55;
    prossimoNumeroOrdine = 7;
    prodotti = LISTINO;
    prossimoIdRiga = 100;
    versione = 0;
    statoNavigazione = null;
    navigateSpy.mockReset();
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

  // ── I gruppi di prodotti ──────────────────────────────────────────────────────────────────

  describe("gruppi di prodotti", () => {
    /** «Spritz» con le due varianti del listino di prova. */
    const GRUPPO_SPRITZ: GruppoProdotti = {
      gruppoProdottiId: 1,
      codice: "SPRITZ",
      nome: "Spritz",
      colore: null,
      ordinamento: 0,
      attivo: true,
      prezzoMinimo: 1.2,
      prezzoUniforme: false,
      membri: [
        { prodottoId: 7, ordinamento: 1, prodotto: LISTINO[0] },
        { prodottoId: 8, ordinamento: 2, prodotto: LISTINO[1] },
      ],
    };

    it("la griglia mostra un tastone invece delle sue varianti", async () => {
      // 🔴 È la ragione della feature: un tasto solo dove al banco ce ne sono dieci. Se le
      //    varianti restassero anche fuori, il gruppo non avrebbe tolto niente.
      gruppi = [GRUPPO_SPRITZ];
      renderPuntoVendita();

      await waitFor(() => expect(screen.getByText("Spritz")).toBeInTheDocument());
      expect(screen.queryByText("Ganter 0.2")).not.toBeInTheDocument();
      expect(screen.queryByText("Espresso")).not.toBeInTheDocument();
    });

    it("il tastone dice «da X €» quando le varianti costano diverso", async () => {
      gruppi = [GRUPPO_SPRITZ];
      renderPuntoVendita();

      await waitFor(() => expect(screen.getByText("da 1,20 €")).toBeInTheDocument());
    });

    it("il tastone dice il prezzo nudo quando costano tutte uguale", async () => {
      // ⚠️ Il «da» su un gruppo a prezzo unico prometterebbe una scelta che non c'è.
      gruppi = [{ ...GRUPPO_SPRITZ, prezzoMinimo: 2.5, prezzoUniforme: true }];
      renderPuntoVendita();

      await waitFor(() => expect(screen.getByText("2,50 €")).toBeInTheDocument());
      expect(screen.queryByText(/da 2,50/)).not.toBeInTheDocument();
    });

    it("il tocco sul gruppo apre le varianti, e battere una la chiude", async () => {
      gruppi = [GRUPPO_SPRITZ];
      renderPuntoVendita();

      await waitFor(() => expect(screen.getByText("Spritz")).toBeInTheDocument());
      await act(async () => {
        screen.getByText("Spritz").click();
      });

      // Le varianti compaiono nel cassetto.
      await waitFor(() => expect(screen.getByText("Ganter 0.2")).toBeInTheDocument());

      await act(async () => {
        screen.getByText("Ganter 0.2").click();
      });

      await waitFor(() => expect(aggiungiRigaSpy).toHaveBeenCalledWith({ ordineId: 55, prodottoId: 7, quantita: 1 }));
      // ⚠️ Il cassetto si chiude da sé: restarci costringerebbe a un tocco in più per tornare
      //    alla griglia, e chi vuole due Aperol ritocca il tastone, che è più corto.
      await waitFor(() => expect(screen.queryByText("Ganter 0.2")).not.toBeInTheDocument());
    });

    it("una ricerca scioglie i gruppi e torna al listino piatto", async () => {
      // 🔴 Chi digita «espresso» sta cercando QUELLA variante: un tastone «Spritz» che la
      //    contiene non è una risposta, ed è un tocco in più proprio nel gesto che doveva
      //    essere più corto.
      gruppi = [GRUPPO_SPRITZ];
      renderPuntoVendita();

      await waitFor(() => expect(screen.getByText("Spritz")).toBeInTheDocument());

      await act(async () => {
        const campo = screen.getByPlaceholderText("Cerca prodotto o codice");
        fireEvent.change(campo, { target: { value: "espresso" } });
      });

      await waitFor(() => expect(screen.getByText("Espresso")).toBeInTheDocument());
      expect(screen.queryByText("Spritz")).not.toBeInTheDocument();
    });

    it("senza gruppi la griglia resta quella di prima", async () => {
      // La proprietà che rende la feature additiva: finché nessuno crea un gruppo, al banco non
      // cambia niente.
      renderPuntoVendita();

      await waitFor(() => expect(screen.getByText("Ganter 0.2")).toBeInTheDocument());
      expect(screen.getByText("Espresso")).toBeInTheDocument();
    });
  });

  // ── Due clienti insieme ───────────────────────────────────────────────────────────────────

  describe("ordini in parallelo", () => {
    it("mette da parte l'ordine in corso e ne apre un altro", async () => {
      // 🔴 Il caso ordinario del bancone: arrivano due ordinazioni insieme, o la seconda mentre
      //    la prima aspetta di pagare. Prima di «Nuovo ordine» l'unico modo di battere il
      //    secondo cliente era chiudere il conto del primo — cioè incassare qualcosa che
      //    nessuno aveva ancora pagato.
      renderPuntoVendita();

      await act(async () => {
        screen.getByText("Ganter 0.2").click();
      });
      await waitFor(() => expect(screen.getByText(/Ordine 260829-007 · 1 voce/)).toBeInTheDocument());

      await act(async () => {
        screen.getByRole("button", { name: "Nuovo ordine" }).click();
      });

      // Il passaggio si vede: la barra torna a dichiarare che non si sta battendo su nulla.
      expect(screen.getByText("Nessun ordine aperto")).toBeInTheDocument();

      await act(async () => {
        screen.getByText("Espresso").click();
      });

      await waitFor(() => expect(apriOrdineSpy).toHaveBeenCalledTimes(2));
      expect(screen.getByText(/Ordine 260829-008 · 1 voce/)).toBeInTheDocument();
    });

    it("l'ordine messo da parte resta aperto con le sue voci", async () => {
      // ⚠️ È l'invariante che conta davvero: mettere da parte non è né chiudere né annullare.
      //    Se le voci del primo cliente sparissero, l'errore si scoprirebbe alla cassa — quando
      //    ormai la consumazione è stata servita.
      renderPuntoVendita();

      await act(async () => {
        screen.getByText("Ganter 0.2").click();
      });
      await waitFor(() => expect(aggiungiRigaSpy).toHaveBeenCalledTimes(1));

      await act(async () => {
        screen.getByRole("button", { name: "Nuovo ordine" }).click();
      });
      await act(async () => {
        screen.getByText("Espresso").click();
      });
      await waitFor(() => expect(apriOrdineSpy).toHaveBeenCalledTimes(2));

      const primo = ordini.find((o) => o.ordineId === 55);
      expect(primo?.stato).toBe("APERTO");
      expect(primo?.righe).toHaveLength(1);
      expect(primo?.totaleCorrente).toBe(2.5);
    });

    it("la voce battuta finisce sull'ordine corrente e non sull'altro", async () => {
      // 🔴 Il guasto che questo esclude non lascia traccia: una consumazione sul conto sbagliato
      //    chiude regolarmente e sposta soldi fra due incassi entrambi plausibili.
      renderPuntoVendita();

      await act(async () => {
        screen.getByText("Ganter 0.2").click();
      });
      await waitFor(() => expect(aggiungiRigaSpy).toHaveBeenCalledTimes(1));

      await act(async () => {
        screen.getByRole("button", { name: "Nuovo ordine" }).click();
      });
      await act(async () => {
        screen.getByText("Espresso").click();
      });
      await waitFor(() => expect(aggiungiRigaSpy).toHaveBeenCalledTimes(2));

      expect(aggiungiRigaSpy).toHaveBeenNthCalledWith(1, { ordineId: 55, prodottoId: 7, quantita: 1 });
      expect(aggiungiRigaSpy).toHaveBeenNthCalledWith(2, { ordineId: 56, prodottoId: 8, quantita: 1 });
    });

    it("riprende l'ordine scelto nella pagina «Ordini», senza aprirne uno nuovo", async () => {
      // 🔴 La pagina passa l'ordine nello `state` della navigazione. Se il punto vendita lo
      //    ignorasse, il gesto «Riprendi» aprirebbe la pagina sul nulla e il tocco successivo
      //    creerebbe un TERZO ordine — mentre i due di prima restano aperti.
      ordini = [{
        ordineId: 91,
        registroCassaId: 3,
        identificativo: "260829-011",
        dataRegistro: "2026-08-29T00:00:00Z",
        numero: 11,
        suffissoSplit: "",
        stato: "APERTO",
        totaleOrdine: 0,
        totaleCorrente: 2.5,
        righe: [],
        apertoIl: "2026-08-29T18:00:00Z",
      }];
      statoNavigazione = { ordineDaRiprendere: 91 };

      renderPuntoVendita();

      await waitFor(() => expect(screen.getByText(/Ordine 260829-011/)).toBeInTheDocument());
      expect(apriOrdineSpy).not.toHaveBeenCalled();
    });

    it("lo stato della navigazione si consuma, e un ritorno indietro non lo rimette", async () => {
      // ⚠️ Senza il `replace`, tornare indietro nel browser rimetterebbe la pagina su
      //    quell'ordine anche dopo averne aperto un altro — e la voce successiva finirebbe sul
      //    conto sbagliato, che è il guasto che non lascia traccia.
      ordini = [{
        ordineId: 91,
        registroCassaId: 3,
        identificativo: "260829-011",
        dataRegistro: "2026-08-29T00:00:00Z",
        numero: 11,
        suffissoSplit: "",
        stato: "APERTO",
        totaleOrdine: 0,
        totaleCorrente: 0,
        righe: [],
        apertoIl: "2026-08-29T18:00:00Z",
      }];
      statoNavigazione = { ordineDaRiprendere: 91 };

      renderPuntoVendita();

      await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith("/gestionale/cassa/vendita", { replace: true, state: null }));
    });

    it("senza un ordine in corso non c'è nulla da mettere da parte", async () => {
      // Il gesto non si offre quando non serve: a pagina appena aperta il primo tocco apre già
      // un ordine da sé, e un pulsante in più sarebbe solo un bersaglio da evitare.
      renderPuntoVendita();

      expect(screen.queryByRole("button", { name: "Nuovo ordine" })).not.toBeInTheDocument();
    });
  });
});
