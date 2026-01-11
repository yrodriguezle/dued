import { useMemo } from "react";
import { CashCount } from "./CashRegisterDetails";

interface CashCountRowData extends Record<string, unknown> {
  denominationId: number;
  type: "COIN" | "BANKNOTE";
  value: number;
  quantity: number;
  total: number;
}

interface UseCashCountDataProps {
  denominations: CashDenomination[];
  openingCounts: CashCount[];
  closingCounts: CashCount[];
}

interface UseCashCountDataResult {
  openingRowData: CashCountRowData[];
  closingRowData: CashCountRowData[];
}

/**
 * Hook che prepara i dati per le griglie di apertura e chiusura cassa
 * Viene chiamato una sola volta da CashRegisterDetails
 */
function useCashCountData({
  denominations,
  openingCounts,
  closingCounts
}: UseCashCountDataProps): UseCashCountDataResult {

  // Prepara i dati per la griglia di apertura (escludi banconote grandi)
  const openingRowData = useMemo(() => {
    const coins = denominations.filter((d) => d.type === "COIN");
    const banknotes = denominations.filter((d) => d.type === "BANKNOTE");

    // Escludi banconote da 10, 20, 50, 100 per l'apertura
    const filteredBanknotes = banknotes.filter(
      (d) => d.value !== 10 && d.value !== 20 && d.value !== 50 && d.value !== 100
    );

    const rows: CashCountRowData[] = [];

    // Monete
    coins.forEach((d) => {
      const count = openingCounts?.find((c) => c.denominationId === d.denominationId);
      const quantity = count?.quantity || 0;
      rows.push({
        denominationId: d.denominationId,
        type: d.type,
        value: d.value,
        quantity,
        total: d.value * quantity,
      });
    });

    // Banconote (filtrate)
    filteredBanknotes.forEach((d) => {
      const count = openingCounts?.find((c) => c.denominationId === d.denominationId);
      const quantity = count?.quantity || 0;
      rows.push({
        denominationId: d.denominationId,
        type: d.type,
        value: d.value,
        quantity,
        total: d.value * quantity,
      });
    });

    return rows;
  }, [denominations, openingCounts]);

  // Prepara i dati per la griglia di chiusura (tutte le banconote)
  const closingRowData = useMemo(() => {
    const coins = denominations.filter((d) => d.type === "COIN");
    const banknotes = denominations.filter((d) => d.type === "BANKNOTE");

    const rows: CashCountRowData[] = [];

    // Monete
    coins.forEach((d) => {
      const count = closingCounts?.find((c) => c.denominationId === d.denominationId);
      const quantity = count?.quantity || 0;
      rows.push({
        denominationId: d.denominationId,
        type: d.type,
        value: d.value,
        quantity,
        total: d.value * quantity,
      });
    });

    // Banconote (tutte)
    banknotes.forEach((d) => {
      const count = closingCounts?.find((c) => c.denominationId === d.denominationId);
      const quantity = count?.quantity || 0;
      rows.push({
        denominationId: d.denominationId,
        type: d.type,
        value: d.value,
        quantity,
        total: d.value * quantity,
      });
    });

    return rows;
  }, [denominations, closingCounts]);

  return { openingRowData, closingRowData };
}

export default useCashCountData;
export type { CashCountRowData };
