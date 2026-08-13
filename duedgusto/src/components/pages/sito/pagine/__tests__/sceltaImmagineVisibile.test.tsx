import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * **Il guasto per cui questo file esiste.**
 *
 * Si sceglieva un'immagine, la modale si chiudeva, e la scheda restava *identica*: stessa
 * miniatura, stesso «1 posto · 1 occupato», stesso testo di provenienza. Le anteprime della
 * scheda arrivano dal **piano del server**, che di una scelta non ancora salvata non sa niente —
 * quindi l'unico riscontro era il pulsante «Salva» che si accendeva, in cima alla pagina e
 * lontano dalle immagini. Un clic senza risposta è indistinguibile da un clic perduto, ed è
 * esattamente così che è stato segnalato: «scegliendo la nuova immagine non veniva cambiata».
 *
 * 🔴 La proprietà pinnata è **la distinzione fra i due stati**, non solo la presenza di
 *    un'anteprima: «ecco cosa il sito rende adesso» e «ecco cosa renderà se salvi» sono due
 *    affermazioni diverse, e mostrarle uguali sarebbe il difetto opposto — dire pubblicato
 *    qualcosa che non lo è ancora.
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
  } as MediaAsset;
}

const IMPOSTAZIONI = {
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
  urlInstagram: null,
  urlFacebook: null,
  metaTitoloDefault: null,
  metaDescrizioneDefault: null,
  immagineOgId: null,
  immagineOg: null,
  // La home ha già una scelta salvata: è il caso in cui «non cambia niente» era più difficile
  // da distinguere da «non ha funzionato».
  immagineEroeHomeId: 1,
  immagineEroeHome: foto(1),
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
  aperitivoPunti: null,
  aperitivoCategorie: null,
  punteggioGoogle: null,
  numeroRecensioniGoogle: null,
  urlProfiloGoogle: null,
  prenotazioniAttive: false,
  prenotazioniPreavvisoOre: 2,
  prenotazioniCopertiMax: 20,
  turnstileSiteKey: null,
  createdAt: "2026-08-13T00:00:00Z",
  updatedAt: "2026-08-13T00:00:00Z",
} as ImpostazioniVetrina;

const PIANO = {
  eroeHome: { mediaAssetId: 1, immagine: foto(1), origine: "SLOT" },
  grigliaHome: [],
  fotoMenu: [],
  ritrattoLocale: { mediaAssetId: null, immagine: null, origine: "POSIZIONE" },
  quadrateLocale: [],
  eroeAperitivo: { mediaAssetId: null, immagine: null, origine: "POSIZIONE" },
  ampiezzaGriglia: 3,
} as RuoliImmaginiVetrina;

const mutate = vi.fn();

vi.mock("@apollo/client", () => ({
  useQuery: (documento: unknown) => {
    const testo = Array.isArray(documento) ? documento.join(" ") : String(documento);
    if (testo.includes("GetRuoliImmaginiVetrina")) {
      return { data: { vetrina: { ruoliImmagini: PIANO } }, loading: false, error: undefined, refetch: vi.fn() };
    }
    if (testo.includes("GetMappaPagineVetrina")) {
      return { data: { vetrina: { mappaPagine: [] } }, loading: false, error: undefined, refetch: vi.fn() };
    }
    return { data: { vetrina: { impostazioni: IMPOSTAZIONI } }, loading: false, error: undefined, refetch: vi.fn() };
  },
  useMutation: () => [mutate, { loading: false }],
  gql: (frammenti: TemplateStringsArray | string) => frammenti,
}));

/**
 * Il selettore finto **restituisce l'asset**, non solo l'id: è il contratto che rende possibile
 * mostrare la scelta prima del salvataggio. Un finto che passasse il solo id lascerebbe passare
 * il guasto originale.
 */
vi.mock("../../MediaPickerDialog", () => ({
  default: ({ open, onSelect }: { open: boolean; onSelect: (id: number | null, asset?: MediaAsset) => void }) =>
    open ? (
      <div data-testid="media-picker">
        <button
          type="button"
          onClick={() => onSelect(9, foto(9))}
        >
          scegli foto-9
        </button>
        {/* Quella GIÀ salvata: serve a dimostrare che risceglierla non è una modifica. */}
        <button
          type="button"
          onClick={() => onSelect(1, foto(1))}
        >
          scegli foto-1
        </button>
        <button
          type="button"
          onClick={() => onSelect(null)}
        >
          scegli nessuna
        </button>
      </div>
    ) : null,
}));

vi.mock("../../../../../graphql/common/useGetAll", () => ({
  default: () => ({ data: [], loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("../../../../../store/useStore", () => {
  const store = { utente: { ruolo: { amministratore: true } }, setFormDirty: vi.fn() };
  const useStore = (selector: (valore: typeof store) => unknown) => selector(store);
  useStore.getState = () => store;
  return { default: useStore };
});

vi.mock("../../../../common/confirm/useConfirm", () => ({ default: () => vi.fn().mockResolvedValue(true) }));

vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#destinazione">{children}</a>,
}));

import PaginaHome from "../PaginaHome";

async function apriIlSelettore(utente: ReturnType<typeof userEvent.setup>) {
  await utente.click(screen.getByRole("button", { name: /modifica/i }));
  await utente.click(screen.getByRole("button", { name: /scegli immagine/i }));
}

describe("La scelta dell'immagine si vede prima del salvataggio", () => {
  beforeEach(() => {
    mutate.mockReset();
    mutate.mockResolvedValue({ data: {} });
  });

  it("mostra l'immagine appena scelta, marcata come non ancora salvata", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<PaginaHome />);

    await apriIlSelettore(utente);
    await utente.click(screen.getByRole("button", { name: "scegli foto-9" }));

    // 🔴 L'affermazione che il guasto violava: dopo il clic, la pagina dice qualcosa.
    await waitFor(() => expect(screen.getByText("da salvare")).toBeInTheDocument());
    expect(screen.getByTitle("foto-9.jpg")).toBeInTheDocument();
  }, 20000);

  it("segnala anche lo stacco dell'immagine, che è una decisione e non un vuoto", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<PaginaHome />);

    await apriIlSelettore(utente);
    await utente.click(screen.getByRole("button", { name: "scegli nessuna" }));

    await waitFor(() => expect(screen.getByText("da salvare")).toBeInTheDocument());
    expect(screen.getByText("Nessuna immagine")).toBeInTheDocument();
  }, 20000);

  it("non annuncia nulla se si risceglie l'immagine che c'era già", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<PaginaHome />);

    await apriIlSelettore(utente);
    await utente.click(screen.getByRole("button", { name: "scegli foto-9" }));
    await waitFor(() => expect(screen.getByText("da salvare")).toBeInTheDocument());

    // `foto(1)` è quella già salvata: tornarci NON è una modifica, e un avviso che restasse
    // acceso anche qui insegnerebbe a ignorarlo — che è il modo in cui gli avvisi muoiono.
    await utente.click(screen.getByRole("button", { name: /scegli immagine/i }));
    await utente.click(screen.getByRole("button", { name: "scegli foto-1" }));

    await waitFor(() => expect(screen.queryByText("da salvare")).not.toBeInTheDocument());
  }, 20000);

  it("l'id scelto arriva davvero nella mutation", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<PaginaHome />);

    await apriIlSelettore(utente);
    await utente.click(screen.getByRole("button", { name: "scegli foto-9" }));
    await utente.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0].variables.input.immagineEroeHomeId).toBe(9);
  }, 20000);

  it("dopo il salvataggio l'avviso «da salvare» sparisce", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<PaginaHome />);

    await apriIlSelettore(utente);
    await utente.click(screen.getByRole("button", { name: "scegli foto-9" }));
    await waitFor(() => expect(screen.getByText("da salvare")).toBeInTheDocument());

    await utente.click(screen.getByRole("button", { name: /salva/i }));

    await waitFor(() => expect(screen.queryByText("da salvare")).not.toBeInTheDocument());
  }, 20000);
});
