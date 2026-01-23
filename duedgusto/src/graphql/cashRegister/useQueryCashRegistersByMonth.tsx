import { useQuery } from "@apollo/client";
import { useCallback, useMemo } from "react";
import dayjs from "dayjs";
import { getRegistriCassaConnection } from "./queries";

interface UseQueryRegistriCassaByMonthProps {
  year: number;
  month: number;
  skip?: boolean;
}

// Funzione per mappare i campi italiani in inglesi per retrocompatibilità
function mapRegistroCassaToLegacy(registro: RegistroCassa): RegistroCassa {
  return {
    ...registro,
    // Alias inglesi
    registerId: registro.id,
    date: registro.data,
    openingCounts: registro.conteggiApertura,
    closingCounts: registro.conteggiChiusura,
    incomes: registro.incassi,
    expenses: registro.spese,
    openingTotal: registro.totaleApertura,
    closingTotal: registro.totaleChiusura,
    cashSales: registro.venditeContanti,
    cashInWhite: registro.incassoContanteTracciato,
    electronicPayments: registro.incassiElettronici,
    invoicePayments: registro.incassiFattura,
    totalSales: registro.totaleVendite,
    supplierExpenses: registro.speseFornitori,
    dailyExpenses: registro.speseGiornaliere,
    expectedCash: registro.contanteAtteso,
    difference: registro.differenza,
    netCash: registro.contanteNetto,
    vatAmount: registro.importoIva,
    notes: registro.note,
    status: registro.stato,
    createdAt: registro.creatoIl,
    updatedAt: registro.aggiornatoIl,
  };
}

export function useQueryCashRegistersByMonth({
  year,
  month,
  skip = false,
}: UseQueryRegistriCassaByMonthProps) {
  // Get first and last day of month
  const firstDay = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
  const lastDay = firstDay.endOf("month");

  const startDate = firstDay.format("YYYY-MM-DD");
  const endDate = lastDay.format("YYYY-MM-DD");

  // Build where clause for date range - use 'data' (Italian field name)
  const whereClause = `data >= '${startDate}' AND data <= '${endDate}'`;

  const { data, loading, error, refetch } = useQuery(getRegistriCassaConnection, {
    variables: {
      pageSize: 100, // Get up to 100 records for the month
      where: whereClause,
      orderBy: "data DESC",
    },
    skip,
  });

  const registriCassa = useMemo(() => {
    const raw = data?.cashManagement?.registriCassaConnection?.elementi || [];
    return raw.map(mapRegistroCassaToLegacy);
  }, [data]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    registriCassa,
    // Legacy alias
    cashRegisters: registriCassa,
    loading,
    error,
    refresh,
  };
}

export default useQueryCashRegistersByMonth;
