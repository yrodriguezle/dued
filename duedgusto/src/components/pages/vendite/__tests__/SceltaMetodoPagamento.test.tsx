import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { METODI_PAGAMENTO } from "../metodiPagamento";
import SceltaMetodoPagamento from "../SceltaMetodoPagamento";

/**
 * Il secondo tocco del punto vendita. I test guardano ciò che, sbagliato, costa soldi veri:
 * che i tre metodi ci siano tutti e tre, che la quantità riparta da 1 a ogni apertura, e che
 * l'etichetta del non tracciato non prometta un effetto che non c'è.
 */

const PRODOTTO: ProdottoVendibile = {
  prodottoId: 7,
  codice: "BIR-GANTER-02",
  nome: "Ganter 0.2",
  prezzo: 2.5,
  categoria: "BIRRA",
  aliquotaIva: 10,
};

describe("SceltaMetodoPagamento", () => {
  const onConferma = vi.fn();
  const onChiudi = vi.fn();

  beforeEach(() => {
    onConferma.mockReset();
    onChiudi.mockReset();
  });

  it("offre tutti e tre i metodi", () => {
    render(
      <SceltaMetodoPagamento
        prodotto={PRODOTTO}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    METODI_PAGAMENTO.forEach((metodo) => {
      expect(screen.getByText(metodo.etichetta)).toBeInTheDocument();
    });
  });

  it("conferma il metodo scelto con quantità 1 di default", () => {
    render(
      <SceltaMetodoPagamento
        prodotto={PRODOTTO}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByText("Elettronico"));

    expect(onConferma).toHaveBeenCalledWith("ELETTRONICO", 1);
  });

  it("porta la quantità scelta nella conferma", () => {
    render(
      <SceltaMetodoPagamento
        prodotto={PRODOTTO}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByLabelText("Aumenta quantità"));
    fireEvent.click(screen.getByLabelText("Aumenta quantità"));
    fireEvent.click(screen.getByText("Contante tracciato"));

    expect(onConferma).toHaveBeenCalledWith("CONTANTE_TRACCIATO", 3);
  });

  it("non scende mai sotto quantità 1", () => {
    render(
      <SceltaMetodoPagamento
        prodotto={PRODOTTO}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    expect(screen.getByLabelText("Diminuisci quantità")).toBeDisabled();
  });

  it("riparte da 1 quando cambia prodotto", () => {
    // La quantità dell'ordinazione precedente non ha niente a che vedere con questa: ricordarla
    // farebbe battere due birre a chi ne voleva una, e nessuno se ne accorgerebbe subito.
    const { rerender } = render(
      <SceltaMetodoPagamento
        prodotto={PRODOTTO}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByLabelText("Aumenta quantità"));
    rerender(
      <SceltaMetodoPagamento
        prodotto={{ ...PRODOTTO, prodottoId: 8, nome: "Engel 0.4" }}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );
    fireEvent.click(screen.getByText("Elettronico"));

    expect(onConferma).toHaveBeenCalledWith("ELETTRONICO", 1);
  });

  it("dice che il contante non tracciato non muove alcun campo", () => {
    // 🔴 L'etichetta è un impegno: quel metodo davvero non scrive niente, perché i soldi sono
    //    già dentro Chiusura − Apertura. Promettere un effetto sarebbe una bugia all'operatore.
    const nonTracciato = METODI_PAGAMENTO.find((m) => m.valore === "CONTANTE_NON_TRACCIATO");
    expect(nonTracciato?.effetto).toMatch(/nessun campo cambia/i);
  });

  it("non mostra nulla senza prodotto scelto", () => {
    render(
      <SceltaMetodoPagamento
        prodotto={null}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    expect(screen.queryByText("Elettronico")).not.toBeInTheDocument();
  });
});
