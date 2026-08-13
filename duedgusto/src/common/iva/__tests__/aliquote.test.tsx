import { describe, it, expect } from "vitest";
import { aliquotaImplicita, arrotondaCentesimi, defaultAliquotaIva } from "../aliquote";

// Stessi casi di IvaCalculatorTests lato backend: le due implementazioni devono restare
// allineate, altrimenti la UI mostra un'aliquota diversa da quella che il server ricaverebbe.

describe("defaultAliquotaIva", () => {
  it("replica il default del backend", () => {
    expect(defaultAliquotaIva).toBe(22);
  });
});

describe("arrotondaCentesimi", () => {
  it("arrotonda al centesimo", () => {
    expect(arrotondaCentesimi(18.499)).toBe(18.5);
    expect(arrotondaCentesimi(100 - 100 / 1.22)).toBe(18.03);
  });
});

describe("aliquotaImplicita", () => {
  it("deriva il rapporto IVA/imponibile in percentuale", () => {
    expect(aliquotaImplicita(100, 22)).toBe(22);
    expect(aliquotaImplicita(227.27, 22.73)).toBe(10);
    expect(aliquotaImplicita(50, 0)).toBe(0);
  });

  it("deriva anche le percentuali che non sono aliquote di legge", () => {
    // Terna Cash & Carry: 23,08 su 204,42 ≈ 11,29% — media ponderata, non un'aliquota reale
    expect(aliquotaImplicita(204.42, 23.08)).toBe(11.29);
  });

  it("restituisce null quando non è derivabile", () => {
    expect(aliquotaImplicita(100, null)).toBeNull();
    expect(aliquotaImplicita(100, undefined)).toBeNull();
    expect(aliquotaImplicita(0, 22)).toBeNull();
    expect(aliquotaImplicita(100, -22)).toBeNull();
  });
});
