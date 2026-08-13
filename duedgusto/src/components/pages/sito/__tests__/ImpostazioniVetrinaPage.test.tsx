import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Due gruppi di prove, con due scopi diversi.
 *
 * Il primo esercita la validazione **come funzione pura**: è dove si dimostra che il controllo
 * incrociato delle coordinate segnala *entrambi* i campi, cosa che un test sull'interfaccia
 * potrebbe mostrare per caso guardandone uno solo.
 *
 * Il secondo rende la pagina e verifica ciò che si può affermare solo di una pagina: che con
 * mezza coordinata **nessuna mutation parte**, che gli orari non hanno alcun campo qui, e che la
 * sezione prenotazioni dichiara di non essere ancora attiva.
 */

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
  telefono: null,
  email: null,
  urlInstagram: "https://www.instagram.com/2dgusto/",
  urlFacebook: null,
  metaTitoloDefault: null,
  metaDescrizioneDefault: null,
  immagineOgId: null,
  immagineOg: null,
  oraInizioTemaSera: "18:00",
  claimVetrina: null,
  storiaTitolo: null,
  storiaTesto: null,
  aperitivoTitolo: null,
  aperitivoTesto: null,
  aperitivoPunti: null,
  aperitivoCategorie: null,
  punteggioGoogle: null,
  numeroRecensioniGoogle: null,
  urlProfiloGoogle: null,
  prenotazioniAttive: false,
  prenotazioniPreavvisoOre: 2,
  prenotazioniCopertiMax: 20,
  turnstileSiteKey: null,
  createdAt: "2026-08-12T00:00:00Z",
  updatedAt: "2026-08-12T00:00:00Z",
};

const mutate = vi.fn();
const datiQuery = { valore: { vetrina: { impostazioni: IMPOSTAZIONI } } };

vi.mock("@apollo/client", () => ({
  useQuery: () => ({ data: datiQuery.valore, loading: false, error: undefined }),
  useMutation: () => [mutate, { loading: false }],
  gql: (frammenti: TemplateStringsArray | string) => frammenti,
}));

vi.mock("../MediaPickerDialog", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="media-picker" /> : null),
}));

vi.mock("../../../../store/useStore", () => {
  const store = { utente: { ruolo: { amministratore: true } }, setFormDirty: vi.fn() };
  const useStore = (selector: (valore: typeof store) => unknown) => selector(store);
  useStore.getState = () => store;
  return { default: useStore };
});

vi.mock("../../../common/confirm/useConfirm", () => ({ default: () => vi.fn().mockResolvedValue(true) }));

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/gestionale/settings">{children}</a>,
}));

import ImpostazioniVetrinaPage from "../ImpostazioniVetrinaPage";
import { inputAperitivo, inputDaValori, inputHome, inputImpostazioni, inputLocale, validaImpostazioniVetrina, valoriDaImpostazioni } from "../impostazioniVetrinaModulo";
import { CAMPI_SCRIVIBILI, PROPRIETA_CAMPI, campiDellaScheda } from "../proprietaCampiVetrina";

const VALORI_BASE = valoriDaImpostazioni(IMPOSTAZIONI);

describe("ImpostazioniVetrinaPage — validazione", () => {
  it("accetta i valori letti dal server così come sono", () => {
    expect(validaImpostazioniVetrina(VALORI_BASE)).toBeUndefined();
  });

  it("rifiuta mezza coordinata segnalando entrambi i campi", () => {
    // 🔴 Mezza coordinata è un punto sull'equatore: un luogo sbagliato mostrato con sicurezza.
    const soloLatitudine = validaImpostazioniVetrina({ ...VALORI_BASE, latitudine: "45.7075", longitudine: "" });
    expect(soloLatitudine?.latitudine).toContain("insieme");
    expect(soloLatitudine?.longitudine).toContain("insieme");

    const soloLongitudine = validaImpostazioniVetrina({ ...VALORI_BASE, latitudine: "", longitudine: "11.4789" });
    expect(soloLongitudine?.latitudine).toContain("insieme");
    expect(soloLongitudine?.longitudine).toContain("insieme");
  });

  it("accetta entrambe le coordinate e accetta l'assenza di entrambe", () => {
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, latitudine: "45.7075", longitudine: "11.4789" })).toBeUndefined();
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, latitudine: "", longitudine: "" })).toBeUndefined();
  });

  it("rifiuta coordinate fuori intervallo", () => {
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, latitudine: "91", longitudine: "11" })?.latitudine).toContain("-90");
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, latitudine: "45", longitudine: "181" })?.longitudine).toContain("-180");
  });

  it("valida l'ora del tema serale con lo stesso rigore del backend", () => {
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, oraInizioTemaSera: "19:30" })).toBeUndefined();
    // Un `\d{2}:\d{2}` accetterebbe entrambi questi: qui il formato è quello stretto del server.
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, oraInizioTemaSera: "25:00" })?.oraInizioTemaSera).toBeDefined();
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, oraInizioTemaSera: "18:60" })?.oraInizioTemaSera).toBeDefined();
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, oraInizioTemaSera: "18.00" })?.oraInizioTemaSera).toBeDefined();
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, oraInizioTemaSera: "" })?.oraInizioTemaSera).toBeDefined();
  });

  it("pretende l'URL completo del profilo social, non il nome utente", () => {
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, urlInstagram: "@2dgusto" })?.urlInstagram).toContain("URL completo");
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, urlFacebook: "2dgusto" })?.urlFacebook).toBeDefined();
    // Vuoto NON è un errore: è il modo di togliere un link già inserito.
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, urlInstagram: "", urlFacebook: "" })).toBeUndefined();
  });

  it("trasforma i campi svuotati in null, non in stringa vuota", () => {
    // L'assegnazione del server è totale: `null` è ciò che cancella davvero il valore.
    const input = inputDaValori({ ...VALORI_BASE, urlInstagram: "", telefono: "   " });
    expect(input.urlInstagram).toBeNull();
    expect(input.telefono).toBeNull();
    expect(input.latitudine).toBeNull();
  });

  it("trasporta la chiave antispam che la pagina non mostra", () => {
    // Non rispedirla la cancellerebbe a ogni salvataggio, in silenzio: l'assegnazione è totale.
    const valori = valoriDaImpostazioni({ ...IMPOSTAZIONI, turnstileSiteKey: "0x4AAA" });
    expect(inputDaValori(valori).turnstileSiteKey).toBe("0x4AAA");
  });

  it("🔴 l'unione delle schede copre esattamente i campi scrivibili, senza sovrapposizioni", () => {
    // ─────────────────────────────────────────────────────────────────────────────────────
    // È la difesa strutturale contro il guasto più silenzioso di questa pagina, e sostituisce
    // il test che confrontava il modulo CON SÉ STESSO — `Object.keys(valori).filter(chiave =>
    // !(chiave in input))`. Quella forma sarebbe rimasta VERDE su una scheda che conosce 4
    // campi su 30 mentre il salvataggio ne azzera 26: il modulo era insieme il misurato e il
    // metro.
    //
    // L'autorità qui è ESTERNA: `CAMPI_SCRIVIBILI`, derivato dalla mappa di proprietà che il
    // compilatore obbliga a essere esaustiva.
    //
    // L'assegnazione del server è TOTALE: scrive tutti i campi del proprio perimetro con
    // quello che riceve. Un campo che nessuna scheda spedisce viene quindi AZZERATO a ogni
    // salvataggio — nessun errore, nessun avviso, nessun sintomo se non che un giorno la
    // storia del locale sparisce dal sito e nessuno sa perché. Il caso è già capitato una
    // volta in questo modulo, ed è la ragione per cui `turnstileSiteKey` viaggia pur non
    // essendo mostrato.
    //
    // 🔴 DUE asserzioni e non una, perché sono DUE proprietà distinte e nessun meccanismo
    //    singolo le copre bene entrambe. La disgiunzione va per prima: un campo conteso
    //    farebbe fallire anche il confronto di totalità (l'elenco avrebbe un elemento in più),
    //    e il messaggio parlerebbe della proprietà sbagliata.
    // ─────────────────────────────────────────────────────────────────────────────────────
    const valori = valoriDaImpostazioni(IMPOSTAZIONI);
    // Coppie (scheda, campo) e non solo i nomi: è ciò che permette al messaggio di nominare
    // **le due schede** che si contendono un campo, e non soltanto il campo.
    const rivendicazioni = ([
      ["impostazioni", inputImpostazioni(valori)],
      ["home", inputHome(valori)],
      ["locale", inputLocale(valori)],
      ["aperitivo", inputAperitivo(valori)],
    ] as const).flatMap(([scheda, input]) => Object.keys(input).map((campo) => ({ scheda, campo })));
    const prodotti = rivendicazioni.map((rivendicazione) => rivendicazione.campo);

    // ① Disgiunzione: nessun campo rivendicato da due schede.
    const contesi = [...new Set(prodotti.filter((campo, indice) => prodotti.indexOf(campo) !== indice))].map(
      (campo) => `${campo} (${rivendicazioni.filter((rivendicazione) => rivendicazione.campo === campo).map((rivendicazione) => rivendicazione.scheda).join(" + ")})`
    );
    expect(contesi, `campi rivendicati da PIÙ DI UNA scheda (vince l'ultima che salva): ${contesi.join(", ") || "—"}`).toEqual([]);

    // ② Totalità: nessun campo orfano e nessun intruso.
    const orfani = CAMPI_SCRIVIBILI.filter((campo) => !prodotti.includes(campo));
    const intrusi = prodotti.filter((campo) => !(CAMPI_SCRIVIBILI as string[]).includes(campo));
    expect({ orfani, intrusi }, `campi scrivibili che NESSUNA scheda spedisce (verrebbero azzerati): ${orfani.join(", ") || "—"} — campi spediti che non sono scrivibili: ${intrusi.join(", ") || "—"}`).toEqual({
      orfani: [],
      intrusi: [],
    });
  });

  it("🔴 la mappa di proprietà è esaustiva e non separa i grappoli a validazione incrociata", () => {
    // La totalità della mappa la garantisce il compilatore (`Record<keyof …>`); qui si fissano
    // le due cose che il compilatore NON vede: quanti campi sono, e dove cadono le due coppie.
    expect(Object.keys(PROPRIETA_CAMPI)).toHaveLength(30);
    expect(CAMPI_SCRIVIBILI).toHaveLength(30);

    // 🔴 I due membri di ciascuna coppia nella STESSA scheda: separati, la regola «insieme o
    //    nessuno dei due» diventerebbe impossibile da valutare al momento del salvataggio.
    expect(PROPRIETA_CAMPI.latitudine).toBe("impostazioni");
    expect(PROPRIETA_CAMPI.longitudine).toBe(PROPRIETA_CAMPI.latitudine);
    expect(PROPRIETA_CAMPI.punteggioGoogle).toBe("home");
    expect(PROPRIETA_CAMPI.numeroRecensioniGoogle).toBe(PROPRIETA_CAMPI.punteggioGoogle);

    // La partizione, per cardinalità: 20 + 4 + 2 + 4 = 30.
    expect({
      impostazioni: campiDellaScheda("impostazioni").length,
      home: campiDellaScheda("home").length,
      locale: campiDellaScheda("locale").length,
      aperitivo: campiDellaScheda("aperitivo").length,
    }).toEqual({ impostazioni: 20, home: 4, locale: 2, aperitivo: 4 });
  });

  it("🔴 punteggio e numero di recensioni: insieme o nessuno dei due", () => {
    // Stessa forma del controllo sulle coordinate, e per la stessa ragione: presi da soli non
    // sono un dato incompleto, sono un dato FUORVIANTE. «4,7» senza conteggio nasconde che le
    // recensioni potrebbero essere tre.
    const soloPunteggio = validaImpostazioniVetrina({ ...VALORI_BASE, punteggioGoogle: "4.7", numeroRecensioniGoogle: "" });
    expect(soloPunteggio?.punteggioGoogle).toMatch(/insieme/i);
    expect(soloPunteggio?.numeroRecensioniGoogle).toMatch(/insieme/i);

    const soloNumero = validaImpostazioniVetrina({ ...VALORI_BASE, punteggioGoogle: "", numeroRecensioniGoogle: "180" });
    expect(soloNumero?.numeroRecensioniGoogle).toMatch(/insieme/i);

    expect(validaImpostazioniVetrina({ ...VALORI_BASE, punteggioGoogle: "4.7", numeroRecensioniGoogle: "180" })).toBeUndefined();
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, punteggioGoogle: "", numeroRecensioniGoogle: "" })).toBeUndefined();
  });

  it("rifiuta un punteggio fuori dalle cinque stelle", () => {
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, punteggioGoogle: "7", numeroRecensioniGoogle: "180" })?.punteggioGoogle).toMatch(/fra 1 e 5/i);
    expect(validaImpostazioniVetrina({ ...VALORI_BASE, punteggioGoogle: "4.7", numeroRecensioniGoogle: "-3" })?.numeroRecensioniGoogle).toMatch(/non negativo/i);
  });

  it("le aree «una voce per riga» arrivano al server come sono state scritte", () => {
    // ⚠️ Non si normalizzano qui: le righe vuote le toglie il DTO pubblico. Ripulirle in due
    //    posti significherebbe due regole che un giorno divergono — e quella che conta è
    //    l'altra, perché è quella che il sito legge.
    const input = inputDaValori({ ...VALORI_BASE, aperitivoPunti: "Un cocktail\n\nIl tagliere\n" });
    expect(input.aperitivoPunti).toBe("Un cocktail\n\nIl tagliere");
  });
});

describe("ImpostazioniVetrinaPage — pagina", () => {
  beforeEach(() => {
    mutate.mockReset();
    mutate.mockResolvedValue({ data: { vetrina: { mutateImpostazioniVetrina: IMPOSTAZIONI } } });
    datiQuery.valore = { vetrina: { impostazioni: IMPOSTAZIONI } };
  });

  it("non mostra alcun campo di orario e indica dove si modificano", () => {
    render(<ImpostazioniVetrinaPage />);

    expect(screen.queryByLabelText(/apertura/i)).toBeNull();
    expect(screen.queryByLabelText(/chiusura/i)).toBeNull();
    expect(screen.queryByLabelText(/fuso/i)).toBeNull();
    expect(screen.getByText(/impostazioni della cassa/i)).toBeInTheDocument();
  });

  it("dichiara che la sezione prenotazioni non è ancora attiva", () => {
    render(<ImpostazioniVetrinaPage />);

    expect(screen.getByText(/Le prenotazioni non sono ancora attive sul sito/i)).toBeInTheDocument();
  });

  it("non invia alcuna mutation quando le coordinate sono incoerenti", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<ImpostazioniVetrinaPage />);

    // Il modulo nasce bloccato, come le altre pagine di dettaglio: prima si sblocca.
    await utente.click(screen.getByRole("button", { name: /modifica/i }));
    await utente.type(screen.getByLabelText("Latitudine"), "45.7075");
    await utente.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => expect(screen.getAllByText(/vanno inserite insieme/i).length).toBeGreaterThan(0));
    expect(mutate).not.toHaveBeenCalled();
  }, 20000);

  it("invia tutti i campi scrivibili quando i valori sono coerenti", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<ImpostazioniVetrinaPage />);

    await utente.click(screen.getByRole("button", { name: /modifica/i }));
    await utente.clear(screen.getByLabelText("Via e numero civico"));
    await utente.type(screen.getByLabelText("Via e numero civico"), "Via Roma 1");
    await utente.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    const input = mutate.mock.calls[0][0].variables.input as ImpostazioniVetrinaInput;
    expect(input.via).toBe("Via Roma 1");
    // Assegnazione totale: gli altri campi viaggiano comunque, non solo quello toccato.
    expect(input.insegnaPubblica).toBe("2D Gusto Bar");
    expect(input.urlInstagram).toBe("https://www.instagram.com/2dgusto/");
    expect(input.oraInizioTemaSera).toBe("18:00");
    // Nessun campo di orario nell'input: non esiste nemmeno come proprietà.
    expect(Object.keys(input)).not.toContain("openingTime");
    expect(Object.keys(input)).not.toContain("closingTime");
  }, 20000);

  it("apre il selettore media già esistente invece di un secondo percorso di caricamento", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<ImpostazioniVetrinaPage />);

    expect(screen.queryByTestId("media-picker")).toBeNull();
    // Il pulsante è disabilitato a modulo bloccato: la scelta scrive un campo, quindi segue la
    // stessa regola di tutti gli altri.
    expect(screen.getByRole("button", { name: /scegli immagine/i })).toBeDisabled();

    await utente.click(screen.getByRole("button", { name: /modifica/i }));
    await utente.click(screen.getByRole("button", { name: /scegli immagine/i }));
    expect(screen.getByTestId("media-picker")).toBeInTheDocument();
  }, 20000);

  it("mostra un modulo vuoto quando la riga non esiste ancora", () => {
    datiQuery.valore = { vetrina: { impostazioni: null } } as unknown as typeof datiQuery.valore;
    render(<ImpostazioniVetrinaPage />);

    expect((screen.getByLabelText("Insegna pubblica") as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/non sono ancora state create/i)).toBeInTheDocument();
  });
});
