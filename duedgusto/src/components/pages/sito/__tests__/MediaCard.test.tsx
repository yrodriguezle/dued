import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import MediaCard from "../MediaCard";
import { RUOLI_IMMAGINI, RuoloRicoperto } from "../pagine/ruoliPagine";

/**
 * I ruoli scritti accanto a ogni immagine della libreria.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **Con il nome della pagina, mai con un numero di posizione.** «La seconda foto» significa
 *    tre cose diverse su tre pagine — è il difetto di partenza di questo change — e riesportarlo
 *    come etichetta sarebbe una beffa.
 *
 * 🔴 **«Nessun ruolo» da solo non è una risposta.** Le due ragioni più comuni sono azionabili:
 *    l'immagine non è pubblicata, oppure è in un'altra cartella. Tacerle lascia l'amministratore
 *    a fissare una foto che «non funziona».
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */

function asset(modifiche: Partial<MediaAsset> = {}): MediaAsset {
  return {
    mediaAssetId: 1,
    chiave: "2026/08/foto-1",
    nomeOriginale: "foto-1.jpg",
    mimeType: "image/jpeg",
    larghezza: 1600,
    altezza: 1200,
    larghezzeDisponibili: [400, 800],
    testoAlternativo: "Una foto",
    cartella: "galleria",
    ordinamento: 1,
    pubblicato: true,
    byteTotali: 1000,
    createdAt: "2026-08-13T00:00:00Z",
    updatedAt: "2026-08-13T00:00:00Z",
    ...modifiche,
  };
}

function ruolo(chiave: string, scelto = false): RuoloRicoperto {
  return { ruolo: RUOLI_IMMAGINI.find((voce) => voce.chiave === chiave)!, scelto };
}

const azioni = { onEdit: vi.fn(), onDelete: vi.fn() };

describe("MediaCard — i ruoli sul sito", () => {
  it("🔴 elenca TUTTI i ruoli che l'immagine ricopre, con il nome della pagina", () => {
    // Lo stato reale della produzione: una sola foto in galleria, che ricopre tre ruoli.
    render(
      <MediaCard
        asset={asset()}
        ruoli={[ruolo("eroeHome"), ruolo("fotoMenu"), ruolo("ritrattoLocale")]}
        pianoNoto
        {...azioni}
      />
    );

    expect(screen.getByText(/questi 3 ruoli/i)).toBeInTheDocument();
    expect(screen.getByText("Home: immagine grande in cima")).toBeInTheDocument();
    expect(screen.getByText("Menu: fotografie del listino")).toBeInTheDocument();
    expect(screen.getByText("Il locale: ritratto verticale")).toBeInTheDocument();
  });

  it("un'immagine senza ruolo lo dice con parole proprie", () => {
    render(
      <MediaCard
        asset={asset()}
        ruoli={[]}
        pianoNoto
        {...azioni}
      />
    );
    expect(screen.getByText(/non compare su nessuna pagina del sito/i)).toBeInTheDocument();
  });

  it("🔴 di un'immagine non pubblicata dice che è la mancata pubblicazione a escluderla", () => {
    render(
      <MediaCard
        asset={asset({ pubblicato: false })}
        ruoli={[]}
        pianoNoto
        {...azioni}
      />
    );
    expect(screen.getByText(/Non pubblicata: finché resta così non entra in nessuna pagina/i)).toBeInTheDocument();
  });

  it("di un'immagine fuori dalla cartella «galleria» dice che è la cartella a escluderla", () => {
    render(
      <MediaCard
        asset={asset({ cartella: "promozioni" })}
        ruoli={[]}
        pianoNoto
        {...azioni}
      />
    );
    expect(screen.getByText(/pescano solo dalla cartella «galleria»/i)).toBeInTheDocument();
  });

  it("finché il piano non è arrivato non dichiara nulla, invece di dire «nessun ruolo» a torto", () => {
    render(
      <MediaCard
        asset={asset()}
        ruoli={[]}
        pianoNoto={false}
        {...azioni}
      />
    );
    expect(screen.queryByText(/nessun ruolo/i)).toBeNull();
  });

  it("nessuna etichetta di ruolo contiene un numero di posizione", () => {
    const etichette = RUOLI_IMMAGINI.map((voce) => voce.etichetta);
    expect(etichette.filter((etichetta) => /\b(prima|seconda|terza|quarta|quinta|ultima|\d+ª|\d+°)\b/i.test(etichetta))).toEqual([]);
  });
});
