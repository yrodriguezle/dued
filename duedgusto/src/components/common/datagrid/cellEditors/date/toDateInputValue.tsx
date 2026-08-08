/**
 * L'input nativo `type="date"` accetta solo `YYYY-MM-DD`, mentre i valori che
 * arrivano dal server possono essere ISO completi (`2026-06-30T00:00:00`):
 * con la componente oraria l'input resta vuoto.
 */
const toDateInputValue = (value: unknown): string => {
  if (typeof value !== "string" || !value) return "";
  return value.split("T")[0];
};

export default toDateInputValue;
