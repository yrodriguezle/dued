import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import OrdineCorrente from "../OrdineCorrente";

/**
 * Le voci del conto aperto. Qui **nessuna azione muove un secchio**: si corregge un tocco
 * sbagliato prima che esista un incasso da spiegare, ed è la libertà che l'ordine aperto compra.
 */

const ORDINE: Ordine = {
  ordineId: 9,
  registroCassaId: 3,
  identificativo: "260829-004",
  dataRegistro: "2026-08-29T00:00:00Z",
  numero: 4,
  suffissoSplit: "",
  stato: "APERTO",
  totaleOrdine: 0,
  totaleCorrente: 5,
  apertoIl: "2026-08-29T18:00:00Z",
  righe: [
    {
      rigaOrdineId: 1,
      ordineId: 9,
      prodottoId: 7,
      quantita: 2,
      prezzoUnitario: 2.5,
      prezzoTotale: 5,
      aliquotaIva: 10,
      dataOra: "2026-08-29T18:00:00Z",
      prodotto: { prodottoId: 7, codice: "BIR-GANTER-02", nome: "Ganter 0.2" },
    },
  ],
};

describe("OrdineCorrente", () => {
  const onCambiaQuantita = vi.fn();
  const onRimuovi = vi.fn();
  const onIncassa = vi.fn();
  const onChiudi = vi.fn();

  beforeEach(() => {
    onCambiaQuantita.mockReset();
    onRimuovi.mockReset();
    onIncassa.mockReset();
    onChiudi.mockReset();
  });

  function renderVoci(ordine: Ordine = ORDINE) {
    return render(
      <OrdineCorrente
        aperto
        ordine={ordine}
        onChiudi={onChiudi}
        onCambiaQuantita={onCambiaQuantita}
        onRimuovi={onRimuovi}
        onIncassa={onIncassa}
      />
    );
  }

  it("mostra il prezzo unitario del tocco, non quello di adesso", () => {
    // Se il listino cambia a ordine aperto, il conto sotto al cliente non si muove: il prezzo
    // mostrato è quello che gli è stato detto.
    renderVoci();

    expect(screen.getByText("2,50 € cad.")).toBeInTheDocument();
    // Due volte: il totale della riga e il totale dell'ordine, che con una voce sola coincidono.
    expect(screen.getAllByText("5,00 €")).toHaveLength(2);
  });

  it("lo stepper chiede la quantità nuova, non un delta", () => {
    renderVoci();

    fireEvent.click(screen.getByLabelText("Aumenta Ganter 0.2"));
    expect(onCambiaQuantita).toHaveBeenCalledWith(ORDINE.righe[0], 3);

    fireEvent.click(screen.getByLabelText("Diminuisci Ganter 0.2"));
    expect(onCambiaQuantita).toHaveBeenCalledWith(ORDINE.righe[0], 1);
  });

  it("non lascia scendere sotto uno: si toglie la voce, non la si azzera", () => {
    const unaSola: Ordine = { ...ORDINE, totaleCorrente: 2.5, righe: [{ ...ORDINE.righe[0], quantita: 1, prezzoTotale: 2.5 }] };
    renderVoci(unaSola);

    expect(screen.getByLabelText("Diminuisci Ganter 0.2")).toBeDisabled();
    expect(screen.getByLabelText("Togli Ganter 0.2 dall'ordine")).not.toBeDisabled();
  });

  it("con l'ordine vuoto non si può incassare", () => {
    renderVoci({ ...ORDINE, righe: [], totaleCorrente: 0 });

    expect(screen.getByText("Nessuna voce battuta. Tocca un prodotto per cominciare.")).toBeInTheDocument();
    expect(screen.getByText("Chiudi ordine")).toBeDisabled();
  });
});
