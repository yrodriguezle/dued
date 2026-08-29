import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DocumentNode, OperationDefinitionNode } from "graphql";

vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }),
  });
});

vi.mock("@apollo/client", async () => {
  const actual = await vi.importActual<typeof import("@apollo/client")>("@apollo/client");
  return {
    ...actual,
    useQuery: (documento: DocumentNode, opzioni?: Record<string, unknown>) => useFinestraQuery(documento, opzioni),
    useMutation: () => [vi.fn(), { loading: false, data: undefined, error: undefined }],
  };
});

vi.mock("../../../../common/toast/showToast", () => ({ default: vi.fn() }));

const navigateSpy = vi.fn();
vi.mock("react-router", () => ({ useNavigate: () => navigateSpy }));

import Ordini from "../Ordini";
import PageTitleContext from "../../../layout/headerBar/PageTitleContext";

// ── Il doppio ────────────────────────────────────────────────────────────────────────────────

/** Due ordini aperti insieme: è il caso per cui questa pagina esiste. */
const ORDINI: Ordine[] = [
  {
    ordineId: 55,
    registroCassaId: 3,
    identificativo: "260829-007",
    dataRegistro: "2026-08-29T00:00:00Z",
    numero: 7,
    suffissoSplit: "",
    stato: "APERTO",
    totaleOrdine: 0,
    totaleCorrente: 5,
    righe: [{ rigaOrdineId: 1, ordineId: 55, prodottoId: 7, quantita: 2, prezzoUnitario: 2.5, prezzoTotale: 5, aliquotaIva: 10, dataOra: "", prodotto: null }],
    apertoIl: "2026-08-29T18:00:00Z",
  },
  {
    ordineId: 56,
    registroCassaId: 3,
    identificativo: "260829-008",
    dataRegistro: "2026-08-29T00:00:00Z",
    numero: 8,
    suffissoSplit: "",
    stato: "APERTO",
    totaleOrdine: 0,
    totaleCorrente: 1.2,
    righe: [{ rigaOrdineId: 2, ordineId: 56, prodottoId: 8, quantita: 1, prezzoUnitario: 1.2, prezzoTotale: 1.2, aliquotaIva: 10, dataOra: "", prodotto: null }],
    apertoIl: "2026-08-29T18:05:00Z",
  },
];

let ordini: Ordine[] = ORDINI;
let variabiliRicevute: Record<string, unknown> | undefined;

function nomeOperazione(documento: DocumentNode): string {
  const definizione = documento.definitions.find((d): d is OperationDefinitionNode => d.kind === "OperationDefinition");
  return definizione?.name?.value ?? "";
}

function useFinestraQuery(documento: DocumentNode, opzioni?: Record<string, unknown>) {
  if (nomeOperazione(documento) === "GetOrdiniAperti") {
    variabiliRicevute = opzioni?.["variables"] as Record<string, unknown> | undefined;
    return { data: { vendite: { ordiniAperti: ordini } }, loading: false, error: undefined, refetch: vi.fn() };
  }
  return { data: undefined, loading: false, error: undefined, refetch: vi.fn() };
}

function renderOrdini() {
  return render(
    <PageTitleContext.Provider value={{ title: "", setTitle: vi.fn() }}>
      <Ordini />
    </PageTitleContext.Provider>
  );
}

describe("la pagina Ordini", () => {
  beforeEach(() => {
    ordini = ORDINI;
    variabiliRicevute = undefined;
    navigateSpy.mockReset();
  });

  it("elenca gli ordini aperti senza che nessuno debba aprire un cassetto", async () => {
    // 🔴 È la ragione della pagina: prima l'elenco si raggiungeva solo di reazione — da dentro il
    //    punto vendita, o dal blocco della chiusura di cassa. Mai di proposito.
    renderOrdini();

    await waitFor(() => expect(screen.getByText("260829-007")).toBeInTheDocument());
    expect(screen.getByText("260829-008")).toBeInTheDocument();
    expect(screen.getByText(/2 ordini per 6,20 € ancora da incassare/)).toBeInTheDocument();
  });

  it("non filtra sul registro di oggi", () => {
    // 🔴 La trappola della mezzanotte: un ordine aperto alle 23:50 sta sul registro di ieri e
    //    alle 00:05 è ancora lì. Filtrare su oggi lo renderebbe invisibile proprio mentre
    //    blocca la chiusura di ieri.
    renderOrdini();

    expect(variabiliRicevute?.["registroCassaId"]).toBeNull();
  });

  it("«Riprendi» porta al punto vendita con l'ordine scelto", async () => {
    // ⚠️ Senza lo `state`, la navigazione aprirebbe il punto vendita sul suo ordine corrente e
    //    quello scelto qui resterebbe dov'era: il gesto sembrerebbe funzionare e non farebbe
    //    nulla di ciò per cui è stato toccato.
    renderOrdini();

    await waitFor(() => expect(screen.getAllByText("Riprendi")).toHaveLength(2));
    screen.getAllByText("Riprendi")[1].click();

    expect(navigateSpy).toHaveBeenCalledWith("/gestionale/cassa/vendita", { state: { ordineDaRiprendere: 56 } });
  });

  it("senza ordini aperti lo dice, invece di mostrare una pagina vuota", async () => {
    ordini = [];
    renderOrdini();

    await waitFor(() => expect(screen.getByText(/Nessun ordine aperto/)).toBeInTheDocument());
  });

  it("non offre un «Chiudi»: non è un cassetto e non ha un chiamante a cui tornare", async () => {
    // Il pulsante vive nel guscio `OrdiniAperti`, non nel corpo. Se scivolasse nel corpo, qui
    // comparirebbe un bottone che non può fare niente.
    renderOrdini();

    await waitFor(() => expect(screen.getByText("260829-007")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Chiudi" })).not.toBeInTheDocument();
  });
});
