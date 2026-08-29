import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { METODI_PAGAMENTO } from "../metodiPagamento";
import ChiusuraOrdine from "../ChiusuraOrdine";

/**
 * L'ultimo tocco dell'ordine. I test guardano ciò che, sbagliato, costa soldi veri: che i tre
 * metodi ci siano tutti e tre, che il tastierino compaia **solo** dove ha senso, e che il resto
 * mostrato sia quello giusto in tutti e tre i casi — esatto, in eccesso, insufficiente.
 *
 * ⚠️ Questo file sostituisce `SceltaMetodoPagamento.test.tsx`: il componente si è spostato da
 *    «ogni voce» a «fine ordine» e le props vecchie — un `ProdottoVendibile` e uno stepper di
 *    quantità — non esistono più. Riadattare quei test avrebbe pinnato un contratto morto.
 */

function ordineDaProva(overrides: Partial<Ordine> = {}): Ordine {
  const righe: RigaOrdine[] = [
    {
      rigaOrdineId: 1,
      ordineId: 9,
      prodottoId: 7,
      quantita: 1,
      prezzoUnitario: 12.5,
      prezzoTotale: 12.5,
      aliquotaIva: 10,
      dataOra: "2026-08-29T18:00:00Z",
      prodotto: { prodottoId: 7, codice: "BIR-GANTER-02", nome: "Ganter 0.2" },
    },
    {
      rigaOrdineId: 2,
      ordineId: 9,
      prodottoId: 8,
      quantita: 1,
      prezzoUnitario: 5,
      prezzoTotale: 5,
      aliquotaIva: 10,
      dataOra: "2026-08-29T18:01:00Z",
      prodotto: { prodottoId: 8, codice: "SPR-APEROL", nome: "Spritz" },
    },
  ];

  return {
    ordineId: 9,
    registroCassaId: 3,
    identificativo: "260829-004",
    dataRegistro: "2026-08-29T00:00:00Z",
    numero: 4,
    suffissoSplit: "",
    stato: "APERTO",
    totaleOrdine: 0,
    totaleCorrente: 17.5,
    righe,
    apertoIl: "2026-08-29T18:00:00Z",
    ...overrides,
  };
}

/** Digita una cifra alla volta sul tastierino, come si fa davvero al banco. */
function digita(cifre: string) {
  cifre.split("").forEach((cifra) => fireEvent.click(screen.getByLabelText(`Cifra ${cifra}`)));
}

describe("ChiusuraOrdine", () => {
  const onConferma = vi.fn();
  const onChiudi = vi.fn();

  beforeEach(() => {
    onConferma.mockReset();
    onChiudi.mockReset();
  });

  it("offre tutti e tre i metodi", () => {
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    METODI_PAGAMENTO.forEach((metodo) => {
      expect(screen.getByText(metodo.etichetta)).toBeInTheDocument();
    });
  });

  it("mostra il totale dell'ordine e il suo identificativo", () => {
    // 🔴 L'identificativo si vede prima di incassare, non solo dopo: è il momento in cui un
    //    numero saltato o duplicato si nota ancora.
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    expect(screen.getByText("17,50 €")).toBeInTheDocument();
    expect(screen.getByText(/260829-004/)).toBeInTheDocument();
  });

  it("con l'elettronico conferma subito, senza chiedere il contante ricevuto", () => {
    // Il server rifiuta un contanteRicevuto insieme a ELETTRONICO: proporre il campo lì
    // porterebbe a un errore alla conferma, col cliente davanti.
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByText("Elettronico"));

    expect(screen.queryByText("Contante ricevuto")).not.toBeInTheDocument();
    expect(onConferma).toHaveBeenCalledWith([{ metodoPagamento: "ELETTRONICO", righeOrdineId: [1, 2], contanteRicevuto: null }]);
  });

  it("con un metodo in contanti apre il tastierino invece di confermare", () => {
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByText("Contante tracciato"));

    expect(onConferma).not.toHaveBeenCalled();
    expect(screen.getByText("Contante ricevuto")).toBeInTheDocument();
    expect(screen.getByLabelText("Cifra 5")).toBeInTheDocument();
  });

  it("calcola il resto da rendere quando il cliente dà più del totale", () => {
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByText("Contante tracciato"));
    digita("2000");

    expect(screen.getByText("Resto da rendere")).toBeInTheDocument();
    expect(screen.getByText("2,50 €")).toBeInTheDocument();
  });

  it("non chiama mai il resto «Resto» da solo", () => {
    // 🔴 `RegistroCassa.resto` è la colonna AG del foglio di chiusura e significa un'altra cosa.
    //    Riusare la parola nuda qui creerebbe in cassa un equivoco che poi non si toglie più.
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByText("Contante tracciato"));
    digita("2000");

    expect(screen.queryByText("Resto")).not.toBeInTheDocument();
  });

  it("con il resto esatto mostra zero e permette comunque di incassare", () => {
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByText("Contante tracciato"));
    digita("1750");

    expect(screen.getByText("Resto da rendere")).toBeInTheDocument();
    expect(screen.getByText("0,00 €")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Incassa 17,50 €"));
    expect(onConferma).toHaveBeenCalledWith([{ metodoPagamento: "CONTANTE_TRACCIATO", righeOrdineId: [1, 2], contanteRicevuto: 17.5 }]);
  });

  it("con un ricevuto insufficiente dice quanto manca e non mostra un resto negativo", () => {
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByText("Contante tracciato"));
    digita("1500");

    expect(screen.getByText(/mancano 2,50 €/)).toBeInTheDocument();
    expect(screen.queryByText("Resto da rendere")).not.toBeInTheDocument();
    expect(screen.getByText("Incassa 17,50 €")).toBeDisabled();
  });

  it("«Importo esatto» conferma senza dichiarare alcun contante ricevuto", () => {
    // `contanteRicevuto: null` significa «importo esatto, non serve il conto», ed è il caso
    // normale: obbligare a digitare il totale sarebbe lavoro per niente.
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByText("Contante non tracciato"));
    fireEvent.click(screen.getByText("Importo esatto"));

    expect(onConferma).toHaveBeenCalledWith([{ metodoPagamento: "CONTANTE_NON_TRACCIATO", righeOrdineId: [1, 2], contanteRicevuto: null }]);
  });

  it("la cancellazione toglie una cifra alla volta", () => {
    render(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    fireEvent.click(screen.getByText("Contante tracciato"));
    digita("2000");
    fireEvent.click(screen.getByLabelText("Cancella ultima cifra"));

    // 20,00 € meno una cifra fa 2,00 €: l'accumulatore è in centesimi, non un testo con la virgola.
    expect(screen.getByText("2,00 €")).toBeInTheDocument();
  });

  it("dice che il contante non tracciato non muove alcun campo", () => {
    // 🔴 L'etichetta è un impegno: quel metodo davvero non scrive niente, perché i soldi sono
    //    già dentro Chiusura − Apertura. Promettere un effetto sarebbe una bugia all'operatore.
    const nonTracciato = METODI_PAGAMENTO.find((m) => m.valore === "CONTANTE_NON_TRACCIATO");
    expect(nonTracciato?.effetto).toMatch(/nessun campo cambia/i);
  });

  it("offre la divisione solo se c'è più di una voce", () => {
    const unaVoceSola = ordineDaProva({ righe: [ordineDaProva().righe[0]], totaleCorrente: 12.5 });
    const { rerender } = render(
      <ChiusuraOrdine
        ordine={unaVoceSola}
        onChiudi={onChiudi}
        onConferma={onConferma}
        onDividi={vi.fn()}
      />
    );

    expect(screen.getByText("Dividi")).toBeDisabled();

    rerender(
      <ChiusuraOrdine
        ordine={ordineDaProva()}
        onChiudi={onChiudi}
        onConferma={onConferma}
        onDividi={vi.fn()}
      />
    );

    expect(screen.getByText("Dividi")).not.toBeDisabled();
  });

  it("non mostra nulla senza un ordine da incassare", () => {
    render(
      <ChiusuraOrdine
        ordine={null}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );

    expect(screen.queryByText("Elettronico")).not.toBeInTheDocument();
  });
});
