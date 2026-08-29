import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import SplitOrdine from "../SplitOrdine";

/**
 * «Il mio spritz lo pago io, il tuo lo paghi tu». Ciò che questi test sorvegliano è il limite
 * dichiarato — si divide per **voci**, non per importo — e le due forme in cui una divisione
 * sbagliata farebbe sparire o raddoppiare soldi: una voce non assegnata, e una parte vuota.
 */

const RIGHE: RigaOrdine[] = [
  {
    rigaOrdineId: 1,
    ordineId: 9,
    prodottoId: 7,
    quantita: 1,
    prezzoUnitario: 8,
    prezzoTotale: 8,
    aliquotaIva: 10,
    dataOra: "2026-08-29T18:00:00Z",
    prodotto: { prodottoId: 7, codice: "SPR-APEROL", nome: "Spritz Aperol" },
  },
  {
    rigaOrdineId: 2,
    ordineId: 9,
    prodottoId: 8,
    quantita: 1,
    prezzoUnitario: 7,
    prezzoTotale: 7,
    aliquotaIva: 10,
    dataOra: "2026-08-29T18:01:00Z",
    prodotto: { prodottoId: 8, codice: "SPR-CAMPARI", nome: "Spritz Campari" },
  },
];

const ORDINE: Ordine = {
  ordineId: 9,
  registroCassaId: 3,
  identificativo: "260829-011",
  dataRegistro: "2026-08-29T00:00:00Z",
  numero: 11,
  suffissoSplit: "",
  stato: "APERTO",
  totaleOrdine: 0,
  totaleCorrente: 15,
  righe: RIGHE,
  apertoIl: "2026-08-29T18:00:00Z",
};

describe("SplitOrdine", () => {
  const onConferma = vi.fn();
  const onChiudi = vi.fn();

  beforeEach(() => {
    onConferma.mockReset();
    onChiudi.mockReset();
  });

  function renderSplit() {
    return render(
      <SplitOrdine
        aperto
        ordine={ORDINE}
        onChiudi={onChiudi}
        onConferma={onConferma}
      />
    );
  }

  it("dice in pagina che la divisione per importo non è supportata", () => {
    // 🔴 Il limite va detto **prima**, non scoperto alla cassa: il server lo rifiuta, ma
    //    l'operatore non deve arrivarci convinto del contrario.
    renderSplit();

    expect(screen.getByText("Si divide per voci, non per importo")).toBeInTheDocument();
    expect(screen.getByText(/20 € in contanti e 10 con carta/)).toBeInTheDocument();
  });

  it("non permette di confermare finché una voce non è assegnata", () => {
    // Una voce dimenticata sparirebbe dal conto: il server la rifiuta, ma un rifiuto arriva
    // sempre più tardi di un pulsante spento.
    renderSplit();

    expect(screen.getByText("Restano 2 voci da assegnare")).toBeInTheDocument();
    expect(screen.getByText("Incassa in 2 parti")).toBeDisabled();

    fireEvent.click(screen.getByText("Spritz Aperol"));

    expect(screen.getByText("Resta 1 voce da assegnare")).toBeInTheDocument();
    expect(screen.getByText("Incassa in 2 parti")).toBeDisabled();
  });

  it("non permette di confermare se una parte resta senza voci", () => {
    renderSplit();

    // Entrambe le voci alla parte A: la B esiste ancora, e uno split con un taglio vuoto è un
    // taglio che il server rifiuta.
    fireEvent.click(screen.getByText("Spritz Aperol"));
    fireEvent.click(screen.getByText("Spritz Campari"));

    expect(screen.getByText(/Una parte è rimasta senza voci/)).toBeInTheDocument();
    expect(screen.getByText("Incassa in 2 parti")).toBeDisabled();
  });

  it("con la partizione completa produce un taglio per parte, con il suo metodo", () => {
    renderSplit();

    fireEvent.click(screen.getByText("Spritz Aperol"));
    fireEvent.click(screen.getByText(/^Parte B/));
    fireEvent.click(screen.getByText("Spritz Campari"));

    expect(screen.getByText("Incassa in 2 parti")).not.toBeDisabled();
    fireEvent.click(screen.getByText("Incassa in 2 parti"));

    expect(onConferma).toHaveBeenCalledWith([
      { metodoPagamento: "ELETTRONICO", righeOrdineId: [1] },
      { metodoPagamento: "CONTANTE_TRACCIATO", righeOrdineId: [2] },
    ]);
  });

  it("mostra il totale che ogni parte sta pagando", () => {
    renderSplit();

    fireEvent.click(screen.getByText("Spritz Aperol"));

    expect(screen.getByText("Parte A · 8,00 €")).toBeInTheDocument();
    expect(screen.getByText("Parte B · 0,00 €")).toBeInTheDocument();
  });

  it("riassegnare una voce la sposta invece di duplicarla", () => {
    // Una voce in due parti la farebbe pagare due volte: l'assegnazione è una mappa, non una
    // lista di adesioni.
    renderSplit();

    fireEvent.click(screen.getByText("Spritz Aperol"));
    fireEvent.click(screen.getByText(/^Parte B/));
    fireEvent.click(screen.getByText("Spritz Aperol"));
    fireEvent.click(screen.getByText("Spritz Campari"));

    expect(screen.getByText(/Una parte è rimasta senza voci/)).toBeInTheDocument();
    expect(screen.getByText("Parte A · 0,00 €")).toBeInTheDocument();
    expect(screen.getByText("Parte B · 15,00 €")).toBeInTheDocument();
  });
});
