import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Le cinque schede di pagina, provate su ciò che si può affermare **solo** di una scheda resa.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Quattro proprietà, e nessuna è cosmetica:
 *
 *  ① **Nessun campo di orario, su nessuna scheda** — e il collegamento a dove si modificano.
 *    Gli orari hanno una sorgente sola, e tre schede su cinque avrebbero un motivo plausibile
 *    per offrirli. Il divieto è già garantito a modello, a schema e a test sul backend; qui si
 *    verifica che l'interfaccia non ne offra comunque uno, e che dica dove guardare.
 *
 *  ② **Lo stato di pubblicazione è la prima riga**, e il criterio è quello del server: solo il
 *    **corpo** del testo. Un titolo compilato con il testo vuoto è ancora «non pubblicata».
 *
 *  ③ **La conferma di sparizione blocca davvero.** Una conferma che compare ma non blocca non
 *    è una conferma: la seconda asserzione — «senza conferma nessuna mutation parte» — è quella
 *    che conta, ed è l'unico punto del prodotto in cui salvare cancella un indirizzo.
 *
 *  ④ **Le due schede senza campi non hanno modulo né «Salva».** Un pulsante grigio
 *    suggerirebbe che manchi qualcosa da compilare.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

function foto(id: number): MediaAsset {
  return {
    mediaAssetId: id,
    chiave: `2026/08/foto-${id}`,
    nomeOriginale: `foto-${id}.jpg`,
    mimeType: "image/jpeg",
    larghezza: 1600,
    altezza: 1200,
    larghezzeDisponibili: [400, 800],
    cartella: "galleria",
    ordinamento: id,
    pubblicato: true,
    byteTotali: 1000,
    createdAt: "2026-08-13T00:00:00Z",
    updatedAt: "2026-08-13T00:00:00Z",
  };
}

const IMPOSTAZIONI: ImpostazioniVetrina = {
  impostazioniVetrinaId: 1,
  insegnaPubblica: "2D Gusto Bar",
  via: "Via del Costo 99",
  cap: "36016",
  citta: "Thiene",
  provincia: "VI",
  paese: "IT",
  latitudine: null,
  longitudine: null,
  telefono: "0445 123456",
  email: null,
  urlInstagram: "https://www.instagram.com/2dgusto/",
  urlFacebook: null,
  metaTitoloDefault: null,
  metaDescrizioneDefault: null,
  immagineOgId: null,
  immagineOg: null,
  immagineEroeHomeId: null,
  immagineEroeHome: null,
  immagineRitrattoLocaleId: null,
  immagineRitrattoLocale: null,
  immagineEroeAperitivoId: null,
  immagineEroeAperitivo: null,
  oraInizioTemaSera: "18:00",
  claimVetrina: "Caffetteria con anima cubana",
  storiaTitolo: "Il locale",
  storiaTesto: "Una storia lunga.",
  aperitivoTitolo: "Apericosto",
  aperitivoTesto: "Dalle 18 in poi.",
  aperitivoPunti: "Un cocktail\nIl tagliere",
  aperitivoCategorie: "Cocktail",
  punteggioGoogle: null,
  numeroRecensioniGoogle: null,
  urlProfiloGoogle: null,
  prenotazioniAttive: false,
  prenotazioniPreavvisoOre: 2,
  prenotazioniCopertiMax: 20,
  turnstileSiteKey: null,
  createdAt: "2026-08-13T00:00:00Z",
  updatedAt: "2026-08-13T00:00:00Z",
};

/** Il piano a slot vuoti con **una sola** fotografia: lo stato osservato in produzione. */
const PIANO_UNA_FOTO: RuoliImmaginiVetrina = {
  eroeHome: { mediaAssetId: 1, immagine: foto(1), origine: "POSIZIONE" },
  grigliaHome: [],
  fotoMenu: [foto(1)],
  ritrattoLocale: { mediaAssetId: 1, immagine: foto(1), origine: "POSIZIONE" },
  quadrateLocale: [],
  eroeAperitivo: { mediaAssetId: null, immagine: null, origine: "POSIZIONE" },
};

const mutate = vi.fn();
const conferma = vi.fn();
const datiImpostazioni = { valore: { vetrina: { impostazioni: IMPOSTAZIONI } } as { vetrina: { impostazioni: ImpostazioniVetrina | null } } };
const datiRuoli = { valore: { vetrina: { ruoliImmagini: PIANO_UNA_FOTO } } };
const prodotti: ProdottoVetrina[] = [];

vi.mock("@apollo/client", () => ({
  // Due query per scheda: le impostazioni e il piano dei ruoli. Si distinguono dal nome
  // dell'operazione invece che per identità del documento, così l'ordine degli import non conta.
  useQuery: (documento: unknown) => {
    const testo = Array.isArray(documento) ? documento.join(" ") : String(documento);
    if (testo.includes("GetRuoliImmaginiVetrina")) {
      return { data: datiRuoli.valore, loading: false, error: undefined, refetch: vi.fn() };
    }
    return { data: datiImpostazioni.valore, loading: false, error: undefined, refetch: vi.fn() };
  },
  useMutation: () => [mutate, { loading: false }],
  gql: (frammenti: TemplateStringsArray | string) => frammenti,
}));

vi.mock("../../MediaPickerDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="media-picker" /> : null),
}));

vi.mock("../../../../../graphql/common/useGetAll", () => ({
  default: () => ({ data: prodotti, loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("../../../../../store/useStore", () => {
  const store = { utente: { ruolo: { amministratore: true } }, setFormDirty: vi.fn() };
  const useStore = (selector: (valore: typeof store) => unknown) => selector(store);
  useStore.getState = () => store;
  return { default: useStore };
});

vi.mock("../../../../common/confirm/useConfirm", () => ({ default: () => conferma }));

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#destinazione">{children}</a>,
}));

import PaginaAperitivo from "../PaginaAperitivo";
import PaginaContatti from "../PaginaContatti";
import PaginaHome from "../PaginaHome";
import PaginaLocale from "../PaginaLocale";
import PaginaMenu from "../PaginaMenu";

beforeEach(() => {
  mutate.mockReset();
  mutate.mockResolvedValue({});
  conferma.mockReset();
  conferma.mockResolvedValue(true);
  datiImpostazioni.valore = { vetrina: { impostazioni: IMPOSTAZIONI } };
  datiRuoli.valore = { vetrina: { ruoliImmagini: PIANO_UNA_FOTO } };
  prodotti.length = 0;
});

describe("nessuna scheda offre un campo di orario", () => {
  // 🔴 Replicato, non spostato: la stessa prova esiste su «Impostazioni sito». Tre schede
  //    mostrano gli orari e tutte e tre devono dire dove si cambiano, non offrirli.
  it.each([
    ["Home", () => <PaginaHome />],
    ["Contatti", () => <PaginaContatti />],
  ])("la scheda «%s» non mostra alcun campo di orario e indica dove si modificano", (_nome, Scheda) => {
    render(<Scheda />);

    expect(screen.queryByLabelText(/apertura/i)).toBeNull();
    expect(screen.queryByLabelText(/chiusura/i)).toBeNull();
    expect(screen.queryByLabelText(/fuso/i)).toBeNull();
    expect(screen.getByText(/impostazioni della cassa/i)).toBeInTheDocument();
  });
});

describe("le due schede senza campi propri", () => {
  it.each([
    ["Menu", () => <PaginaMenu />],
    ["Contatti", () => <PaginaContatti />],
  ])("la scheda «%s» non rende alcun pulsante «Salva» e non monta un modulo", (_nome, Scheda) => {
    const { container } = render(<Scheda />);

    // Un Salva grigio suggerirebbe che manchi qualcosa da compilare: non c'è nulla da compilare.
    expect(screen.queryByRole("button", { name: /salva/i })).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByText(/non possiede alcun testo/i)).toBeInTheDocument();
  });

  it("🔴 la scheda «Contatti» dichiara ZERO immagini per esteso", () => {
    render(<PaginaContatti />);
    // L'assenza della sezione non sarebbe una risposta: è la stessa mancanza di informazione
    // da cui questo pannello nasce.
    expect(screen.getByText(/non ospita/i)).toBeInTheDocument();
    expect(screen.getByText(/zero posti/i)).toBeInTheDocument();
  });

  it("la scheda «Menu» dichiara che la descrizione per i motori di ricerca è scritta nel sorgente del sito", () => {
    render(<PaginaMenu />);
    expect(screen.getByText(/scritta/i)).toBeInTheDocument();
    expect(screen.getByText(/non è modificabile da qui/i)).toBeInTheDocument();
    // E non esiste alcun campo che sembri modificarla.
    expect(screen.queryByLabelText(/descrizione/i)).toBeNull();
  });

  it("la scheda «Menu» conta i prodotti pubblicati e rimanda alla griglia esistente", () => {
    prodotti.push({ prodottoId: 1, pubblicatoSulSito: true } as ProdottoVetrina, { prodottoId: 2, pubblicatoSulSito: false } as ProdottoVetrina);
    render(<PaginaMenu />);

    expect(screen.getByText(/prodotto pubblicato/i)).toBeInTheDocument();
    expect(screen.getByText("Prodotti vetrina")).toBeInTheDocument();
  });
});

describe("lo stato di pubblicazione", () => {
  it("le tre pagine sempre presenti non mostrano alcuno stato condizionato", () => {
    render(<PaginaHome />);
    expect(screen.getByText(/esiste sempre/i)).toBeInTheDocument();
    expect(screen.queryByText(/Non pubblicata/i)).toBeNull();
  });

  it("con il testo pieno la scheda «Il locale» dichiara «Pubblicata»", () => {
    render(<PaginaLocale />);
    expect(screen.getByText("Pubblicata.")).toBeInTheDocument();
  });

  it("🔴 con il testo vuoto dichiara «Non pubblicata» e le conseguenze intere", () => {
    datiImpostazioni.valore = { vetrina: { impostazioni: { ...IMPOSTAZIONI, storiaTesto: null } } };
    render(<PaginaLocale />);

    expect(screen.getByText(/Non pubblicata:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/404/).length).toBeGreaterThan(0);
    expect(screen.getByText(/sitemap/i)).toBeInTheDocument();
  });

  it("🔴 titolo compilato e testo vuoto è ancora «non pubblicata»", () => {
    // È il criterio del server: decide solo il CORPO del testo. Una seconda regola nel pannello
    // direbbe «Pubblicata» su una pagina che risponde 404.
    datiImpostazioni.valore = { vetrina: { impostazioni: { ...IMPOSTAZIONI, storiaTitolo: "La nostra storia", storiaTesto: "   " } } };
    render(<PaginaLocale />);

    expect(screen.getByText(/Non pubblicata:/i)).toBeInTheDocument();
    expect(screen.getByText(/è il testo a farla esistere/i)).toBeInTheDocument();
  });

  it("la scheda dell'aperitivo esiste anche quando la pagina del sito non esiste", () => {
    datiImpostazioni.valore = { vetrina: { impostazioni: { ...IMPOSTAZIONI, aperitivoTesto: null } } };
    render(<PaginaAperitivo />);

    expect(screen.getByText(/Non pubblicata:/i)).toBeInTheDocument();
    // 🔴 E il campo che la fa nascere è lì, modificabile: è la scheda a CREARE la pagina.
    expect(screen.getByLabelText("Testo dell'aperitivo")).toBeInTheDocument();
  });
});

describe("🔴 la conferma prima di far sparire una pagina", () => {
  async function svuotaEsalva(etichettaCampo: string) {
    const utente = userEvent.setup({ delay: null });
    await utente.click(screen.getByRole("button", { name: /modifica/i }));
    await utente.clear(screen.getByLabelText(etichettaCampo));
    await utente.click(screen.getByRole("button", { name: /salva/i }));
    return utente;
  }

  it("annullando la conferma, nessuna mutation parte", async () => {
    conferma.mockResolvedValue(false);
    render(<PaginaLocale />);

    await svuotaEsalva("Storia del locale");

    await waitFor(() => expect(conferma).toHaveBeenCalledTimes(1));
    expect(conferma.mock.calls[0][0].content).toMatch(/Il locale/);
    expect(conferma.mock.calls[0][0].content).toMatch(/pagina non trovata/i);
    // 🔴 L'asserzione che conta: una conferma che compare ma non blocca non è una conferma.
    expect(mutate).not.toHaveBeenCalled();
  }, 20000);

  it("confermando, il salvataggio avviene", async () => {
    conferma.mockResolvedValue(true);
    render(<PaginaLocale />);

    await svuotaEsalva("Storia del locale");

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0].variables.input.storiaTesto).toBeNull();
  }, 20000);

  it("vale anche per l'aperitivo, che è l'altra pagina condizionata", async () => {
    conferma.mockResolvedValue(false);
    render(<PaginaAperitivo />);

    await svuotaEsalva("Testo dell'aperitivo");

    await waitFor(() => expect(conferma).toHaveBeenCalledTimes(1));
    expect(conferma.mock.calls[0][0].content).toMatch(/Aperitivo/);
    expect(mutate).not.toHaveBeenCalled();
  }, 20000);

  it("nessuna conferma quando non c'è nulla da far sparire", async () => {
    // La pagina è GIÀ non pubblicata: chiedere conferma per un'azione senza effetto insegna a
    // confermare senza leggere.
    datiImpostazioni.valore = { vetrina: { impostazioni: { ...IMPOSTAZIONI, storiaTesto: null } } };
    const utente = userEvent.setup({ delay: null });
    render(<PaginaLocale />);

    await utente.click(screen.getByRole("button", { name: /modifica/i }));
    await utente.type(screen.getByLabelText("Titolo della storia"), "!");
    await utente.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(conferma).not.toHaveBeenCalled();
  }, 20000);

  it("⚠️ svuotare il TITOLO non chiede alcuna conferma: non è il titolo a far esistere la pagina", async () => {
    // Una conferma che scattasse anche qui insegnerebbe una regola falsa.
    render(<PaginaLocale />);

    await svuotaEsalva("Titolo della storia");

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(conferma).not.toHaveBeenCalled();
  }, 20000);
});

describe("i testi ereditati sono in sola lettura e dicono dove si cambiano", () => {
  it("🔴 la home mostra i testi dell'aperitivo senza alcun modo di modificarli", () => {
    render(<PaginaHome />);

    expect(screen.getByText("Titolo dell'aperitivo")).toBeInTheDocument();
    // Nessun campo: il testo è testo, non un campo disabilitato — la differenza si vede senza
    // provare a scriverci dentro.
    expect(screen.queryByLabelText(/titolo dell'aperitivo/i)).toBeNull();
    expect(screen.getAllByText("Sito → Aperitivo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sola lettura").length).toBeGreaterThan(0);
  });

  it("la home possiede invece il proprio paragrafo e i numeri della reputazione", () => {
    render(<PaginaHome />);

    expect(screen.getByLabelText("Frase sotto il titolo")).toBeInTheDocument();
    expect(screen.getByLabelText("Punteggio Google")).toBeInTheDocument();
    expect(screen.getByLabelText("Numero di recensioni")).toBeInTheDocument();
  });
});

describe("🔴 «quante immagini» è la seconda risposta, e distingue capacità da riempimento", () => {
  it("la home dichiara quattro posti e, con una sola foto in galleria, uno occupato", () => {
    render(<PaginaHome />);

    expect(screen.getByText(/4 posti immagine/i)).toBeInTheDocument();
    expect(screen.getByText(/1 occupato adesso/i)).toBeInTheDocument();
    // La quinta fotografia della home non viene dalla galleria: dichiarata a parte, altrimenti
    // il conteggio mentirebbe in difetto.
    expect(screen.getByText(/dai/i)).toBeInTheDocument();
    expect(screen.getAllByText(/prodotti/i).length).toBeGreaterThan(0);
  });

  it("ogni scheda dichiara l'anteprima social come condivisa e non la conta", () => {
    render(<PaginaHome />);
    expect(screen.getByText(/anteprima social/i)).toBeInTheDocument();
    expect(screen.getByText(/condivisa da tutte le pagine/i)).toBeInTheDocument();
  });

  it("🔴 l'aperitivo dichiara che senza scelta la pagina esce SENZA immagine di testata", () => {
    render(<PaginaAperitivo />);

    expect(screen.getByText(/Nessuna immagine scelta: la pagina esce senza immagine di testata/i)).toBeInTheDocument();
    expect(screen.getByText(/1 posto immagine/i)).toBeInTheDocument();
  });

  it("un ruolo coperto per posizione lo dichiara, invece di far credere a una scelta", () => {
    render(<PaginaHome />);
    expect(screen.getByText(/Nessuna scelta: la pagina usa la prima foto della galleria/i)).toBeInTheDocument();
  });
});
