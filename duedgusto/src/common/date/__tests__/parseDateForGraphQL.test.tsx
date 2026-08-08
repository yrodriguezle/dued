import { describe, it, expect } from "vitest";
import { parseDateForGraphQL, parseDateOnlyForGraphQL } from "../date";

describe("parseDateForGraphQL — input GraphQL di tipo DateTime", () => {
  it("normalizza una data ISO a mezzanotte mantenendo la componente oraria", () => {
    expect(parseDateForGraphQL("2026-06-30")).toBe("2026-06-30T00:00:00");
  });

  it("accetta il formato italiano", () => {
    expect(parseDateForGraphQL("30/06/2026")).toBe("2026-06-30T00:00:00");
  });

  it("e idempotente su un valore gia normalizzato", () => {
    expect(parseDateForGraphQL("2026-06-30T00:00:00")).toBe("2026-06-30T00:00:00");
  });

  it("restituisce undefined su input vuoto o non riconosciuto", () => {
    expect(parseDateForGraphQL("")).toBeUndefined();
    expect(parseDateForGraphQL("non-una-data")).toBeUndefined();
  });
});

describe("parseDateOnlyForGraphQL — input GraphQL di tipo Date", () => {
  // Regressione: PagamentoFornitoreInput.dataPagamento e mappato su DateGraphType
  // e rifiuta la componente oraria. Passargli il risultato di parseDateForGraphQL
  // faceva fallire la mutation con:
  // "Variable '$pagamento.dataPagamento' is invalid. Unable to convert
  //  '2026-06-30T00:00:00' to 'Date'".
  it("non emette mai la componente oraria", () => {
    expect(parseDateOnlyForGraphQL("2026-06-30")).toBe("2026-06-30");
    expect(parseDateOnlyForGraphQL("30/06/2026")).toBe("2026-06-30");
  });

  it("spoglia la componente oraria dai valori che tornano dal server", () => {
    expect(parseDateOnlyForGraphQL("2026-06-30T00:00:00")).toBe("2026-06-30");
  });

  it("restituisce undefined su input vuoto o non riconosciuto", () => {
    expect(parseDateOnlyForGraphQL("")).toBeUndefined();
    expect(parseDateOnlyForGraphQL("non-una-data")).toBeUndefined();
  });
});
