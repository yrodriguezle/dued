import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Il campo della cartella è il punto in cui la galleria del sito si popola o resta vuota per
 * sempre. Due proprietà lo pinnano, e sono in tensione fra loro apposta:
 *  1. le opzioni **vengono dal server** — il frontend non ha un elenco proprio da far divergere;
 *  2. l'insieme resta **aperto** — un valore digitato e non suggerito viene comunque accettato.
 * Una tendina chiusa soddisfa la prima e rompe la seconda.
 */

const CONFIGURAZIONE: MediaConfigurazione = {
  maxByteFile: 10 * 1024 * 1024,
  maxMegapixel: 30,
  larghezzeVarianti: [400, 800],
  mimeAmmessi: ["image/jpeg"],
  cartelleSuggerite: ["generale", "galleria"],
};

const makeRequestMock = vi.fn();

vi.mock("../../../../api/makeRequest", () => ({
  default: (...argomenti: unknown[]) => makeRequestMock(...argomenti),
}));

vi.mock("../MediaUploadArea", () => ({
  default: ({ cartella }: { cartella: string }) => <div data-testid="upload-area">{cartella}</div>,
}));

vi.mock("../MediaCard", () => ({
  default: () => <div data-testid="media-card" />,
}));

const assets: MediaAsset[] = [];

vi.mock("../../../../graphql/common/useGetAll", () => ({
  default: () => ({ data: assets, loading: false, error: null, refetch: vi.fn() }),
}));

vi.mock("@apollo/client", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
  // La libreria legge anche il piano dei ruoli, per scrivere accanto a ogni immagine dove
  // compare sul sito. Qui non serve: `MediaCard` è finta e queste prove parlano della cartella.
  useQuery: () => ({ data: undefined, loading: false, error: undefined, refetch: vi.fn() }),
  gql: (frammenti: TemplateStringsArray | string) => frammenti,
}));

vi.mock("../../../../store/useStore", () => ({
  default: (selector: (store: Store) => unknown) => selector({ utente: { ruolo: { amministratore: true } } } as unknown as Store),
}));

vi.mock("../../../../common/toast/showToast", () => ({ default: vi.fn() }));

vi.mock("../../../common/confirm/useConfirm", () => ({ default: () => vi.fn() }));

import MediaLibrary from "../MediaLibrary";

function campoCartella(): HTMLInputElement {
  return screen.getByLabelText("Cartella di destinazione") as HTMLInputElement;
}

describe("MediaLibrary — cartella di destinazione", () => {
  beforeEach(() => {
    assets.length = 0;
    makeRequestMock.mockReset();
    makeRequestMock.mockResolvedValue(CONFIGURAZIONE);
  });

  it("propone la cartella della galleria fra le opzioni che arrivano dal server", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<MediaLibrary />);

    // La prima cartella suggerita dal server diventa il valore iniziale: nessun default
    // scritto nel frontend, quindi niente che possa divergere dal backend.
    await waitFor(() => expect(campoCartella().value).toBe("generale"));

    await utente.click(campoCartella());

    const opzioni = await screen.findAllByRole("option");
    expect(opzioni.map((opzione) => opzione.textContent)).toEqual(["galleria", "generale"]);
  }, 20000);

  it("accetta un valore digitato che non è fra le opzioni proposte", async () => {
    const utente = userEvent.setup({ delay: null });
    render(<MediaLibrary />);
    await waitFor(() => expect(campoCartella().value).toBe("generale"));

    await utente.clear(campoCartella());
    await utente.type(campoCartella(), "eventi");

    expect(campoCartella().value).toBe("eventi");
    // L'area di caricamento riceve davvero il valore digitato: il campo è `freeSolo`, non una
    // tendina chiusa che richiederebbe un deploy per ogni nuova cartella.
    expect(screen.getByTestId("upload-area")).toHaveTextContent("eventi");
  }, 20000);

  it("propone anche le cartelle già in uso che il server non suggerisce", async () => {
    assets.push({
      mediaAssetId: 1,
      chiave: "2026/08/prova-a1b2c3",
      nomeOriginale: "prova.jpg",
      mimeType: "image/jpeg",
      larghezza: 800,
      altezza: 600,
      larghezzeDisponibili: [400, 800],
      cartella: "promozioni",
      ordinamento: 0,
      pubblicato: true,
      byteTotali: 1000,
      createdAt: "2026-08-12T00:00:00Z",
      updatedAt: "2026-08-12T00:00:00Z",
    });

    const utente = userEvent.setup({ delay: null });
    render(<MediaLibrary />);
    await waitFor(() => expect(campoCartella().value).toBe("generale"));

    await utente.click(campoCartella());

    const opzioni = await screen.findAllByRole("option");
    expect(opzioni.map((opzione) => opzione.textContent)).toContain("promozioni");
  }, 20000);
});
