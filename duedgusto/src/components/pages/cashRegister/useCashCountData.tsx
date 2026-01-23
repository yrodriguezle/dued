import { useMemo } from "react";

// Row data type with English field names for component compatibility
interface CashCountRowData extends Record<string, unknown> {
  denominationId: number;
  type: "COIN" | "BANKNOTE";
  value: number;
  quantity: number;
  total: number;
}

interface UseCashCountDataProps {
  denominations: DenominazioneMoneta[];
  openingCounts: ConteggioMoneta[];
  closingCounts: ConteggioMoneta[];
}

interface UseCashCountDataResult {
  openingRowData: CashCountRowData[];
  closingRowData: CashCountRowData[];
}

/**
 * Hook che prepara i dati per le griglie di apertura e chiusura cassa
 * Viene chiamato una sola volta da CashRegisterDetails
 * Usa nomi inglesi per compatibilità con i componenti esistenti
 */
function useCashCountData({
  denominations,
  openingCounts,
  closingCounts
}: UseCashCountDataProps): UseCashCountDataResult {

  // Prepara i dati per la griglia di apertura (escludi banconote grandi)
  const openingRowData = useMemo(() => {
    // Usa campi italiani o inglesi per compatibilità
    const coins = denominations.filter((d) => (d.tipo || d.type) === "COIN");
    const banknotes = denominations.filter((d) => (d.tipo || d.type) === "BANKNOTE");

    // Escludi banconote da 10, 20, 50, 100 per l'apertura
    const filteredBanknotes = banknotes.filter((d) => {
      const value = d.valore ?? d.value ?? 0;
      return value !== 10 && value !== 20 && value !== 50 && value !== 100;
    });

    const rows: CashCountRowData[] = [];

    // Monete
    coins.forEach((d) => {
      const denominationId = d.id ?? d.denominationId ?? 0;
      const count = openingCounts?.find((c) =>
        (c.denominazioneMonetaId ?? c.denominationId) === denominationId
      );
      const quantity = count?.quantita ?? count?.quantity ?? 0;
      const value = d.valore ?? d.value ?? 0;
      rows.push({
        denominationId,
        type: (d.tipo ?? d.type) as "COIN" | "BANKNOTE",
        value,
        quantity,
        total: value * quantity,
      });
    });

    // Banconote (filtrate)
    filteredBanknotes.forEach((d) => {
      const denominationId = d.id ?? d.denominationId ?? 0;
      const count = openingCounts?.find((c) =>
        (c.denominazioneMonetaId ?? c.denominationId) === denominationId
      );
      const quantity = count?.quantita ?? count?.quantity ?? 0;
      const value = d.valore ?? d.value ?? 0;
      rows.push({
        denominationId,
        type: (d.tipo ?? d.type) as "COIN" | "BANKNOTE",
        value,
        quantity,
        total: value * quantity,
      });
    });

    return rows;
  }, [denominations, openingCounts]);

  // Prepara i dati per la griglia di chiusura (tutte le banconote)
  const closingRowData = useMemo(() => {
    const coins = denominations.filter((d) => (d.tipo || d.type) === "COIN");
    const banknotes = denominations.filter((d) => (d.tipo || d.type) === "BANKNOTE");

    const rows: CashCountRowData[] = [];

    // Monete
    coins.forEach((d) => {
      const denominationId = d.id ?? d.denominationId ?? 0;
      const count = closingCounts?.find((c) =>
        (c.denominazioneMonetaId ?? c.denominationId) === denominationId
      );
      const quantity = count?.quantita ?? count?.quantity ?? 0;
      const value = d.valore ?? d.value ?? 0;
      rows.push({
        denominationId,
        type: (d.tipo ?? d.type) as "COIN" | "BANKNOTE",
        value,
        quantity,
        total: value * quantity,
      });
    });

    // Banconote (tutte)
    banknotes.forEach((d) => {
      const denominationId = d.id ?? d.denominationId ?? 0;
      const count = closingCounts?.find((c) =>
        (c.denominazioneMonetaId ?? c.denominationId) === denominationId
      );
      const quantity = count?.quantita ?? count?.quantity ?? 0;
      const value = d.valore ?? d.value ?? 0;
      rows.push({
        denominationId,
        type: (d.tipo ?? d.type) as "COIN" | "BANKNOTE",
        value,
        quantity,
        total: value * quantity,
      });
    });

    return rows;
  }, [denominations, closingCounts]);

  return { openingRowData, closingRowData };
}

export default useCashCountData;
export type { CashCountRowData };
