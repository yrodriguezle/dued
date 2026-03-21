/**
 * Formatta un numero in formato valuta italiana (es. 1.234,50)
 * Usa il punto come separatore delle migliaia e la virgola come separatore decimale.
 */
export default function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "0,00";
  return Number(value).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
}
