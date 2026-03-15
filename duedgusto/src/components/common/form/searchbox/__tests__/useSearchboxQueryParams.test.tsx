import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import useSearchboxQueryParams from "../useSearchboxQueryParams";
import useQueryParams from "../../../../../graphql/common/useQueryParams";
import { SearchboxOptions } from "../../../../../@types/searchbox";
import { UseQueryParamsProps } from "../../../../../graphql/common/useQueryParams";

// Mock di useQueryParams per evitare dipendenze Apollo Client (gql, TypedDocumentNode).
// Usiamo mockImplementation per catturare i parametri passati e renderli ispezionabili.
vi.mock("../../../../../graphql/common/useQueryParams", () => ({
  default: vi.fn(),
}));

const mockUseQueryParams = vi.mocked(useQueryParams);

/**
 * Ritorna i parametri passati all'ultima chiamata del mock useQueryParams.
 * Utilizzato per verificare where e body calcolati dall'hook.
 */
function getLastCallParams(): UseQueryParamsProps<Record<string, unknown>> {
  const calls = mockUseQueryParams.mock.calls;
  if (calls.length === 0) {
    throw new Error("useQueryParams non è stato chiamato");
  }
  return calls[calls.length - 1][0];
}

type TestItem = Record<string, unknown> & {
  id: number;
  ragioneSociale: string;
  codice: string;
};

const baseOptions: SearchboxOptions<TestItem> = {
  query: "fornitori",
  id: "id",
  tableName: "fornitore",
  items: [
    { field: "ragioneSociale", headerName: "Ragione Sociale" },
    { field: "codice", headerName: "Codice" },
  ],
  modal: {
    title: "Seleziona fornitore",
    items: [
      { field: "ragioneSociale", headerName: "Ragione Sociale" },
      { field: "codice", headerName: "Codice" },
      { field: "id", headerName: "ID" },
    ],
  },
};

/**
 * Helper che renderizza l'hook e restituisce i parametri catturati da useQueryParams.
 */
function renderAndCapture(
  value: string,
  options: SearchboxOptions<TestItem> = baseOptions,
  modal = false,
  pageSize = 10
): UseQueryParamsProps<Record<string, unknown>> {
  renderHook(() =>
    useSearchboxQueryParams<TestItem, keyof TestItem>({
      options,
      value,
      fieldName: "ragioneSociale",
      modal,
      pageSize,
    })
  );
  return getLastCallParams();
}

// ----------------------------------------------------------------
// REQ-SB-003: Input vuoto
// ----------------------------------------------------------------
describe("useSearchboxQueryParams — input vuoto (REQ-SB-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe passare WHERE vuoto a useQueryParams con input stringa vuota", () => {
    const params = renderAndCapture("");
    expect(params.where).toBe("");
  });

  it("dovrebbe passare WHERE vuoto a useQueryParams con input di soli spazi", () => {
    const params = renderAndCapture("   ");
    expect(params.where).toBe("");
  });

  it("dovrebbe passare WHERE vuoto a useQueryParams con input di tab e spazi", () => {
    const params = renderAndCapture("  \t  ");
    expect(params.where).toBe("");
  });
});

// ----------------------------------------------------------------
// REQ-SB-002: Filtraggio progressivo — parola singola
// ----------------------------------------------------------------
describe("useSearchboxQueryParams — singola parola (REQ-SB-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe generare tableName.field LIKE per una singola parola", () => {
    const params = renderAndCapture("Mar");
    expect(params.where).toBe('fornitore.ragioneSociale LIKE "%Mar%"');
  });

  it("dovrebbe preservare il case della parola cercata", () => {
    const params = renderAndCapture("mario");
    expect(params.where).toBe('fornitore.ragioneSociale LIKE "%mario%"');
  });
});

// ----------------------------------------------------------------
// REQ-SB-002: Filtraggio progressivo — parole multiple
// ----------------------------------------------------------------
describe("useSearchboxQueryParams — parole multiple (REQ-SB-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe generare due condizioni AND con due parole", () => {
    const params = renderAndCapture("Mar Ros");
    expect(params.where).toBe(
      'fornitore.ragioneSociale LIKE "%Mar%" AND fornitore.ragioneSociale LIKE "%Ros%"'
    );
  });

  it("dovrebbe generare tre condizioni AND con tre parole", () => {
    const params = renderAndCapture("Mar Ros Srl");
    expect(params.where).toBe(
      'fornitore.ragioneSociale LIKE "%Mar%" AND fornitore.ragioneSociale LIKE "%Ros%" AND fornitore.ragioneSociale LIKE "%Srl%"'
    );
  });

  it("dovrebbe usare AND (non OR) tra condizioni di parole multiple", () => {
    const params = renderAndCapture("Mar Ros");
    expect(params.where).not.toContain("OR");
    expect(params.where).toContain("AND");
  });
});

// ----------------------------------------------------------------
// REQ-SB-002: Gestione spazi extra
// ----------------------------------------------------------------
describe("useSearchboxQueryParams — trimming e spazi extra (REQ-SB-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe trimmere spazi iniziali e finali producendo singola condizione", () => {
    const params = renderAndCapture("  Mar  ");
    expect(params.where).toBe('fornitore.ragioneSociale LIKE "%Mar%"');
  });

  it("dovrebbe ignorare spazi multipli tra le parole producendo le stesse condizioni", () => {
    const paramsConSpazi = renderAndCapture("Mar   Ros");
    vi.clearAllMocks();
    const paramsSenzaSpazi = renderAndCapture("Mar Ros");
    expect(paramsConSpazi.where).toBe(paramsSenzaSpazi.where);
  });
});

// ----------------------------------------------------------------
// REQ-SB-001: Combinazione regularWhere e additionalWhere
// ----------------------------------------------------------------
describe("useSearchboxQueryParams — additionalWhere (REQ-SB-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe passare solo regularWhere senza additionalWhere", () => {
    const optionsSenzaAdditional: SearchboxOptions<TestItem> = {
      ...baseOptions,
      additionalWhere: undefined,
    };
    const params = renderAndCapture("Mar", optionsSenzaAdditional);
    expect(params.where).toBe('fornitore.ragioneSociale LIKE "%Mar%"');
    // Nessuna parentesi aggiuntiva quando c'è solo regularWhere
    expect(params.where).not.toMatch(/^\(/);
  });

  it("dovrebbe combinare regularWhere e additionalWhere con AND tra parentesi", () => {
    const optionsConAdditional: SearchboxOptions<TestItem> = {
      ...baseOptions,
      additionalWhere: "fornitore.attivo = 1",
    };
    const params = renderAndCapture("Mar", optionsConAdditional);
    expect(params.where).toBe(
      '(fornitore.ragioneSociale LIKE "%Mar%") AND (fornitore.attivo = 1)'
    );
  });

  it("dovrebbe usare AND (non OR) per combinare regularWhere e additionalWhere", () => {
    const optionsConAdditional: SearchboxOptions<TestItem> = {
      ...baseOptions,
      additionalWhere: "fornitore.attivo = 1",
    };
    const params = renderAndCapture("Mar", optionsConAdditional);
    expect(params.where).not.toContain("OR");
    const andCount = (params.where?.match(/ AND /g) ?? []).length;
    expect(andCount).toBe(1);
  });

  it("dovrebbe passare solo additionalWhere quando input è vuoto", () => {
    const optionsConAdditional: SearchboxOptions<TestItem> = {
      ...baseOptions,
      additionalWhere: "fornitore.attivo = 1",
    };
    const params = renderAndCapture("", optionsConAdditional);
    // Con input vuoto, regularWhere è "": solo additionalWhere senza parentesi
    expect(params.where).toBe("fornitore.attivo = 1");
  });

  it("dovrebbe trattare additionalWhere stringa vuota come assente", () => {
    const optionsAdditionalVuoto: SearchboxOptions<TestItem> = {
      ...baseOptions,
      additionalWhere: "",
    };
    const paramsSenzaAdditional = renderAndCapture("Mar", baseOptions);
    vi.clearAllMocks();
    const paramsAdditionalVuoto = renderAndCapture("Mar", optionsAdditionalVuoto);
    expect(paramsAdditionalVuoto.where).toBe(paramsSenzaAdditional.where);
  });

  it("dovrebbe combinare correttamente con parole multiple e additionalWhere", () => {
    const optionsConAdditional: SearchboxOptions<TestItem> = {
      ...baseOptions,
      additionalWhere: "fornitore.attivo = 1",
    };
    const params = renderAndCapture("Mar Ros", optionsConAdditional);
    expect(params.where).toBe(
      '(fornitore.ragioneSociale LIKE "%Mar%" AND fornitore.ragioneSociale LIKE "%Ros%") AND (fornitore.attivo = 1)'
    );
  });
});

// ----------------------------------------------------------------
// REQ-SB-013: Costruzione body della query
// ----------------------------------------------------------------
describe("useSearchboxQueryParams — costruzione body (REQ-SB-013)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe passare i campi di options.items per modalità dropdown (modal=false)", () => {
    const params = renderAndCapture("", baseOptions, false);
    const body = params.body as string[];
    expect(body).toContain("ragioneSociale");
    expect(body).toContain("codice");
    // Non deve includere il campo "id" che è solo in modal.items
    expect(body).not.toContain("id");
  });

  it("dovrebbe passare i campi di options.modal.items per modalità modale (modal=true)", () => {
    const params = renderAndCapture("", baseOptions, true, 100);
    const body = params.body as string[];
    expect(body).toContain("ragioneSociale");
    expect(body).toContain("codice");
    expect(body).toContain("id");
    expect(body).toHaveLength(3);
  });
});

// ----------------------------------------------------------------
// Caratteri speciali nell'input
// ----------------------------------------------------------------
describe("useSearchboxQueryParams — caratteri speciali nell'input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe includere caratteri speciali nel LIKE senza modificarli", () => {
    const params = renderAndCapture("S.r.l.");
    expect(params.where).toBe('fornitore.ragioneSociale LIKE "%S.r.l.%"');
  });

  it("dovrebbe gestire apostrofi nel testo di ricerca", () => {
    const params = renderAndCapture("Dell'Arte");
    expect(params.where).toBe("fornitore.ragioneSociale LIKE \"%Dell'Arte%\"");
  });
});
