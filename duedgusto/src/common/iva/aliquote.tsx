// Speculare a backend/Common/IvaCalculator.cs. Serve al frontend solo per MOSTRARE
// imponibile, IVA e aliquota mentre si compila un form; il calcolo che finisce a database
// resta quello del backend.
//
// La modalità di una fattura (IVA calcolata o digitata) NON si deduce da qui: è il campo
// persistito `ivaCalcolata`.

export const defaultAliquotaIva = 22;

/** Arrotondamento al centesimo, come i campi valuta decimal(10,2). */
export function arrotondaCentesimi(valore: number): number {
  return Math.round(valore * 100) / 100;
}

/**
 * Aliquota implicita di un documento già valorizzato (IVA / imponibile), in percentuale
 * arrotondata al centesimo. `null` se non derivabile: IVA assente, imponibile nullo,
 * o rapporto negativo (dati incoerenti).
 *
 * Su una fattura a IVA digitata è una media ponderata, non un'aliquota reale: va mostrata
 * come tale e non usata per decidere nulla.
 */
export function aliquotaImplicita(imponibile: number, importoIva: number | null | undefined): number | null {
  if (importoIva == null || !imponibile) {
    return null;
  }
  const frazione = importoIva / imponibile;
  return frazione < 0 ? null : arrotondaCentesimi(frazione * 100);
}
