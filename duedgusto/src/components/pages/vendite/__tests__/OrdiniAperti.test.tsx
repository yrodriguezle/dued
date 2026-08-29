import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { DocumentNode, OperationDefinitionNode } from "graphql";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual<typeof import("@apollo/client")>("@apollo/client");
  return {
    ...actual,
    useQuery: (documento: DocumentNode, opzioni?: Record<string, unknown>) => finestraQuery(documento, opzioni),
    useMutation: (documento: DocumentNode) => finestraMutation(documento),
  };
});

vi.mock("../../../../common/toast/showToast", () => ({ default: vi.fn() }));

import OrdiniAperti from "../OrdiniAperti";

/**
 * L'elenco degli ordini aperti. Il caso che questi test tengono fermo è **la trappola della
 * mezzanotte**: un ordine aperto ieri sera resta sul registro di ieri, e se sparisse da questo
 * elenco bloccherebbe per sempre la chiusura di quel giorno senza farsi trovare.
 */

let ordini: Ordine[] = [];
const annullaSpy = vi.fn();

function nomeOperazione(documento: DocumentNode): string {
  const definizione = documento.definitions.find((d): d is OperationDefinitionNode => d.kind === "OperationDefinition");
  return definizione?.name?.value ?? "";
}

function finestraQuery(documento: DocumentNode, opzioni?: Record<string, unknown>) {
  const saltata = Boolean(opzioni?.skip);
  const refetch = vi.fn(async () => ({ data: undefined }));
  if (nomeOperazione(documento) === "GetOrdiniAperti") {
    return { data: saltata ? undefined : { vendite: { ordiniAperti: ordini } }, loading: false, error: undefined, refetch };
  }
  return { data: undefined, loading: false, error: undefined, refetch };
}

function finestraMutation(documento: DocumentNode) {
  const nome = nomeOperazione(documento);
  const esegui = vi.fn(async ({ variables }: { variables?: Record<string, unknown> } = {}) => {
    if (nome === "AnnullaOrdine") {
      annullaSpy(variables);
    }
    return { data: undefined };
  });
  return [esegui, { loading: false, data: undefined, error: undefined }];
}

function ordineDaProva(overrides: Partial<Ordine> = {}): Ordine {
  return {
    ordineId: 41,
    registroCassaId: 3,
    identificativo: "260828-002",
    dataRegistro: "2026-08-28T00:00:00Z",
    numero: 2,
    suffissoSplit: "",
    stato: "APERTO",
    totaleOrdine: 0,
    totaleCorrente: 18.5,
    apertoIl: "2026-08-28T23:50:00Z",
    righe: [
      {
        rigaOrdineId: 1,
        ordineId: 41,
        prodottoId: 7,
        quantita: 1,
        prezzoUnitario: 18.5,
        prezzoTotale: 18.5,
        aliquotaIva: 10,
        dataOra: "2026-08-28T23:50:00Z",
        prodotto: { prodottoId: 7, codice: "TAG-01", nome: "Tagliere" },
      },
    ],
    ...overrides,
  };
}

describe("OrdiniAperti", () => {
  beforeEach(() => {
    ordini = [];
    annullaSpy.mockReset();
    // «Oggi» è il 29: l'ordine di prova è del 28, cioè della cassa di ieri.
    vi.setSystemTime(new Date("2026-08-29T10:00:00Z"));
  });

  it("mostra un ordine del registro di ieri, con la data di quel registro", () => {
    // 🔴 Se questo elenco filtrasse su oggi, l'ordine sparirebbe alle 00:05 e la chiusura di ieri
    //    resterebbe bloccata da un ordine invisibile.
    ordini = [ordineDaProva()];
    render(
      <OrdiniAperti
        aperto
        onChiudi={vi.fn()}
      />
    );

    expect(screen.getByText("260828-002")).toBeInTheDocument();
    expect(screen.getByText("Cassa del 28/08/2026")).toBeInTheDocument();
    expect(screen.getByText("18,50 €")).toBeInTheDocument();
  });

  it("offre le due uscite su ogni riga: incassa e annulla", () => {
    // Senza queste due, l'errore della chiusura di cassa sarebbe un vicolo cieco.
    ordini = [ordineDaProva()];
    render(
      <OrdiniAperti
        aperto
        onChiudi={vi.fn()}
      />
    );

    expect(screen.getByText("Incassa")).toBeInTheDocument();
    expect(screen.getByText("Annulla")).toBeInTheDocument();
  });

  it("mostra «riprendi» solo dove c'è dove riprenderlo", () => {
    ordini = [ordineDaProva()];
    const { rerender } = render(
      <OrdiniAperti
        aperto
        onChiudi={vi.fn()}
      />
    );

    expect(screen.queryByText("Riprendi")).not.toBeInTheDocument();

    rerender(
      <OrdiniAperti
        aperto
        onChiudi={vi.fn()}
        onRiprendi={vi.fn()}
      />
    );

    expect(screen.getByText("Riprendi")).toBeInTheDocument();
  });

  it("l'annullo pretende un motivo prima di partire", async () => {
    // 🔴 È la scappatoia che sblocca la chiusura di cassa, e una scappatoia senza traccia non
    //    controlla niente. Il server la rifiuta comunque: qui il pulsante resta spento.
    ordini = [ordineDaProva()];
    render(
      <OrdiniAperti
        aperto
        onChiudi={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Annulla"));

    expect(screen.getByText("Annulla l'ordine 260828-002")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annulla l'ordine" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Cliente andato via" } });
    await act(async () => {
      screen.getByRole("button", { name: "Annulla l'ordine" }).click();
    });

    expect(annullaSpy).toHaveBeenCalledWith({ ordineId: 41, motivo: "Cliente andato via" });
  });

  it("un motivo fatto di soli spazi non vale come traccia", () => {
    ordini = [ordineDaProva()];
    render(
      <OrdiniAperti
        aperto
        onChiudi={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Annulla"));
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "   " } });

    expect(screen.getByRole("button", { name: "Annulla l'ordine" })).toBeDisabled();
  });

  it("senza ordini aperti lo dice, invece di mostrare un elenco vuoto", () => {
    render(
      <OrdiniAperti
        aperto
        onChiudi={vi.fn()}
      />
    );

    expect(screen.getByText(/Nessun ordine aperto/)).toBeInTheDocument();
  });

  it("porta in cima la descrizione del blocco quando arriva dalla chiusura di cassa", () => {
    ordini = [ordineDaProva()];
    render(
      <OrdiniAperti
        aperto
        titolo="Ordini che bloccano la chiusura"
        descrizione="Un ordine aperto è un incasso non ancora dichiarato."
        onChiudi={vi.fn()}
      />
    );

    expect(screen.getByText("Ordini che bloccano la chiusura")).toBeInTheDocument();
    expect(screen.getByText("Un ordine aperto è un incasso non ancora dichiarato.")).toBeInTheDocument();
  });
});
