import { useMemo } from "react";

// Row data per le griglie di conteggio
interface CashCountRowData extends Record<string, unknown> {
  denominationId: number;
  type: "COIN" | "BANKNOTE";
  value: number;
  quantity: number;
  total: number;
}

// Tipo per i conteggi (importato da CashRegisterDetails)
import type { CashCount } from "./RegistroCassaDetails";

interface UseCashCountDataProps {
  denominations: DenominazioneMoneta[];
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
function useCashCountData({ denominations, openingCounts, closingCounts }: UseCashCountDataProps): UseCashCountDataResult {
  // Prepara i dati per la griglia di apertura (escludi banconote grandi)
  const openingRowData = useMemo(() => {
    const coins = denominations.filter((d) => d.tipo === "COIN");
    const banknotes = denominations.filter((d) => d.tipo === "BANKNOTE");

    // Escludi banconote da 10, 20, 50, 100 per l'apertura
    const filteredBanknotes = banknotes.filter((d) => {
      return d.valore !== 10 && d.valore !== 20 && d.valore !== 50 && d.valore !== 100;
    });

    const rows: CashCountRowData[] = [];

    // Monete
    coins.forEach((d) => {
      const count = openingCounts?.find((c) => c.denominazioneMonetaId === d.id);
      const quantity = count?.quantita ?? 0;
      rows.push({
        denominationId: d.id,
        type: d.tipo,
        value: d.valore,
        quantity,
        total: d.valore * quantity,
      });
    });

    // Banconote (filtrate)
    filteredBanknotes.forEach((d) => {
      const count = openingCounts?.find((c) => c.denominazioneMonetaId === d.id);
      const quantity = count?.quantita ?? 0;
      rows.push({
        denominationId: d.id,
        type: d.tipo,
        value: d.valore,
        quantity,
        total: d.valore * quantity,
      });
    });

    return rows;
  }, [denominations, openingCounts]);

  // Prepara i dati per la griglia di chiusura (tutte le banconote)
  const closingRowData = useMemo(() => {
    const coins = denominations.filter((d) => d.tipo === "COIN");
    const banknotes = denominations.filter((d) => d.tipo === "BANKNOTE");

    const rows: CashCountRowData[] = [];

    // Monete
    coins.forEach((d) => {
      const count = closingCounts?.find((c) => c.denominazioneMonetaId === d.id);
      const quantity = count?.quantita ?? 0;
      rows.push({
        denominationId: d.id,
        type: d.tipo,
        value: d.valore,
        quantity,
        total: d.valore * quantity,
      });
    });

    // Banconote (tutte)
    banknotes.forEach((d) => {
      const count = closingCounts?.find((c) => c.denominazioneMonetaId === d.id);
      const quantity = count?.quantita ?? 0;
      rows.push({
        denominationId: d.id,
        type: d.tipo,
        value: d.valore,
        quantity,
        total: d.valore * quantity,
      });
    });

    return rows;
  }, [denominations, closingCounts]);

  return { openingRowData, closingRowData };
}

export default useCashCountData;
export type { CashCountRowData };
