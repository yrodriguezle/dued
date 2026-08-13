import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Il selettore condiviso da tutte e tre le pagine che assegnano un'immagine — prodotti vetrina,
 * impostazioni sito, schede di pagina. Era l'unico pezzo della sezione Sito senza prove, e i tre
 * chiamanti lo sostituiscono con un finto nei loro test: un guasto qui non lasciava traccia da
 * nessuna parte, che è esattamente come si presentava.
 *
 * Le proprietà pinnate qui sono le tre che rendono il dialogo *usabile*, non solo funzionante:
 *  1. la didascalia non copre l'immagine — si sceglie guardando;
 *  2. un errore si vede — un dialogo vuoto per permessi negati non è distinguibile, altrimenti,
 *     da una libreria vuota;
 *  3. solo i pubblicati entrano nell'elenco.
 */

const statoQuery: { data: MediaAsset[]; loading: boolean; error: Error | null } = {
  data: [],
  loading: false,
  error: null,
};

vi.mock("../../../../graphql/common/useGetAll", () => ({
  default: () => ({ ...statoQuery, refetch: vi.fn() }),
}));

import MediaPickerDialog from "../MediaPickerDialog";

function asset(parziale: Partial<MediaAsset> & { mediaAssetId: number }): MediaAsset {
  return {
    chiave: `2026/08/foto-${parziale.mediaAssetId}`,
    nomeOriginale: `foto-${parziale.mediaAssetId}.jpg`,
    mimeType: "image/jpeg",
    larghezza: 800,
    altezza: 600,
    larghezzeDisponibili: [400, 800],
    testoAlternativo: null,
    didascalia: null,
    focale: null,
    placeholder: null,
    cartella: "galleria",
    ordinamento: 0,
    pubblicato: true,
    byteTotali: 1024,
    createdAt: "2026-08-01T00:00:00",
    updatedAt: "2026-08-01T00:00:00",
    ...parziale,
  } as MediaAsset;
}

describe("MediaPickerDialog", () => {
  beforeEach(() => {
    statoQuery.data = [];
    statoQuery.loading = false;
    statoQuery.error = null;
  });

  it("elenca solo i media pubblicati", () => {
    statoQuery.data = [asset({ mediaAssetId: 1 }), asset({ mediaAssetId: 2, pubblicato: false })];

    render(
      <MediaPickerDialog
        open
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("foto-1.jpg")).toBeInTheDocument();
    expect(screen.queryByText("foto-2.jpg")).not.toBeInTheDocument();
  });

  /**
   * 🔴 Restituisce **l'asset**, non solo l'id. È il contratto su cui poggia il riscontro
   *    immediato della scelta: con il solo id, chi chiama non ha l'immagine da mostrare e la
   *    modale si chiude senza che cambi nulla — il guasto per cui «scegli immagine» sembrava
   *    non funzionare.
   */
  it("restituisce l'asset scelto, non solo il suo id", async () => {
    const utente = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    const scelto = asset({ mediaAssetId: 7 });
    statoQuery.data = [scelto];

    render(
      <MediaPickerDialog
        open
        onClose={vi.fn()}
        onSelect={onSelect}
      />
    );

    await utente.click(screen.getByText("foto-7.jpg"));

    expect(onSelect).toHaveBeenCalledWith(7, scelto);
  });

  it("stacca l'immagine con «Nessuna immagine»", async () => {
    const utente = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    statoQuery.data = [asset({ mediaAssetId: 7 })];

    render(
      <MediaPickerDialog
        open
        selezionatoId={7}
        onClose={vi.fn()}
        onSelect={onSelect}
      />
    );

    await utente.click(screen.getByRole("button", { name: "Nessuna immagine" }));

    expect(onSelect).toHaveBeenCalledWith(null);
  });

  /**
   * 🔴 La prova che manca al guasto originale: la query rifiutata rendeva un dialogo vuoto,
   *    indistinguibile da una libreria senza foto. «Non funziona» era tutto ciò che restava
   *    da dire.
   */
  it("dice perché l'elenco è vuoto quando la lettura fallisce", () => {
    statoQuery.error = new Error("Operazione riservata agli amministratori");

    render(
      <MediaPickerDialog
        open
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Operazione riservata agli amministratori");
    expect(screen.queryByText(/Nessun media pubblicato/)).not.toBeInTheDocument();
  });

  it("non annuncia una libreria vuota mentre sta ancora caricando", () => {
    statoQuery.loading = true;

    render(
      <MediaPickerDialog
        open
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText(/Nessun media pubblicato/)).not.toBeInTheDocument();
  });

  /**
   * La didascalia è un fratello dell'immagine nel flusso normale, non una barra sovrapposta:
   * è ciò che le restituisce la metà inferiore. Un ritorno all'overlay riaccende questa prova.
   */
  it("non sovrappone la didascalia alla miniatura", () => {
    statoQuery.data = [asset({ mediaAssetId: 3 })];

    render(
      <MediaPickerDialog
        open
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    const didascalia = screen.getByText("foto-3.jpg");
    const immagine = screen.getByRole("img");
    expect(didascalia.compareDocumentPosition(immagine) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(document.querySelector(".MuiImageListItemBar-root")).toBeNull();
  });
});
