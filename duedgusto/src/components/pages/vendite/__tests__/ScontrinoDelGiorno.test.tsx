import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DocumentNode, OperationDefinitionNode } from "graphql";

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual<typeof import("@apollo/client")>("@apollo/client");
  return {
    ...actual,
    useQuery: (documento: DocumentNode, opzioni?: Record<string, unknown>) => finestraQuery(documento, opzioni),
    useMutation: () => [vi.fn(async () => ({ data: undefined })), { loading: false, data: undefined, error: undefined }],
  };
});

vi.mock("../../../../common/toast/showToast", () => ({ default: vi.fn() }));

vi.mock("../../../../store/useStore", () => ({
  default: Object.assign((selettore: (stato: unknown) => unknown) => selettore({ utente: utenteCorrente }), { getState: () => ({}) }),
}));

import ScontrinoDelGiorno from "../ScontrinoDelGiorno";

/**
 * Lo scontrino con gli ordini in mezzo.
 *
 * <p>Quello che questi test tengono fermo è la conseguenza della guardia: con un ordine dietro,
 * `aggiornaVendita` ed `eliminaVendita` **rifiutano** la riga, quindi le due icone di correzione
 * non devono comparire. Mostrarle darebbe due pulsanti che rispondono solo con un errore, ed è
 * peggio che non averli.</p>
 */

let utenteCorrente: unknown = null;

const ORDINI = [
  {
    ordineId: 55,
    identificativo: "260829-007",
    stato: "CHIUSO",
  },
];

function nomeOperazione(documento: DocumentNode): string {
  const definizione = documento.definitions.find((d): d is OperationDefinitionNode => d.kind === "OperationDefinition");
  return definizione?.name?.value ?? "";
}

function finestraQuery(documento: DocumentNode, opzioni?: Record<string, unknown>) {
  const saltata = Boolean(opzioni?.skip);
  const refetch = vi.fn(async () => ({ data: undefined }));
  if (nomeOperazione(documento) === "GetOrdiniDelRegistro") {
    return { data: saltata ? undefined : { vendite: { ordiniDelRegistro: ORDINI } }, loading: false, error: undefined, refetch };
  }
  return { data: undefined, loading: false, error: undefined, refetch };
}

const REGISTRO = { id: 3, data: "2026-08-29", totaleVendite: 100 } as unknown as RegistroCassa;

function vendita(overrides: Partial<Vendita> = {}): Vendita {
  return {
    venditaId: 1,
    registroCassaId: 3,
    ordineId: 55,
    prodottoId: 7,
    quantita: 1,
    prezzoUnitario: 2.5,
    prezzoTotale: 2.5,
    aliquotaIva: 10,
    imponibile: 2.27,
    importoIva: 0.23,
    dataOra: "2026-08-29T18:00:00Z",
    metodoPagamento: "ELETTRONICO",
    createdAt: "2026-08-29T18:00:00Z",
    updatedAt: "2026-08-29T18:00:00Z",
    prodotto: { prodottoId: 7, codice: "BIR-GANTER-02", nome: "Ganter 0.2" },
    ...overrides,
  };
}

function renderScontrino(vendite: Vendita[]) {
  return render(
    <ScontrinoDelGiorno
      aperto
      vendite={vendite}
      registroCassa={REGISTRO}
      onChiudi={vi.fn()}
      onModificato={vi.fn()}
    />
  );
}

describe("ScontrinoDelGiorno", () => {
  beforeEach(() => {
    utenteCorrente = { ruolo: { amministratore: false } };
  });

  it("raggruppa le righe per ordine e ne mostra l'identificativo", () => {
    renderScontrino([vendita(), vendita({ venditaId: 2, prodottoId: 8, prezzoTotale: 1.2, prodotto: { prodottoId: 8, codice: "CAF", nome: "Espresso" } })]);

    expect(screen.getByText(/Ordine 260829-007 · 3,70 €/)).toBeInTheDocument();
  });

  it("non lascia correggere una riga nata da un ordine", () => {
    // 🔴 Il server la rifiuta e indica `stornaOrdine`: due icone che rispondono solo con un
    //    errore sarebbero peggio che nessuna icona.
    renderScontrino([vendita()]);

    expect(screen.queryByLabelText(/^Cambia metodo/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Elimina/)).not.toBeInTheDocument();
  });

  it("lascia correggere le righe senza ordine, nate col vecchio regime", () => {
    renderScontrino([vendita({ ordineId: null })]);

    expect(screen.getByLabelText("Cambia metodo di Ganter 0.2")).toBeInTheDocument();
    expect(screen.getByLabelText("Elimina Ganter 0.2")).toBeInTheDocument();
    expect(screen.getByText(/Righe senza ordine/)).toBeInTheDocument();
  });

  it("offre lo storno solo a un amministratore", () => {
    // 🔴 Asimmetria voluta con l'annullo, che è per chiunque venda: qui si tocca un numero che
    //    qualcuno ha già letto per quadrare la giornata.
    const { rerender } = renderScontrino([vendita()]);
    expect(screen.queryByText("Storna")).not.toBeInTheDocument();

    utenteCorrente = { ruolo: { amministratore: true } };
    rerender(
      <ScontrinoDelGiorno
        aperto
        vendite={[vendita()]}
        registroCassa={REGISTRO}
        onChiudi={vi.fn()}
        onModificato={vi.fn()}
      />
    );

    expect(screen.getByText("Storna")).toBeInTheDocument();
  });

  it("senza incassi dice che gli ordini aperti non compaiono qui", () => {
    // Una `Vendita` esiste solo se qualcuno ha pagato: un ordine ancora aperto non è un incasso,
    // e vederlo qui farebbe credere incassato ciò che non lo è.
    renderScontrino([]);

    expect(screen.getByText(/Gli ordini ancora aperti non compaiono qui/)).toBeInTheDocument();
  });
});
