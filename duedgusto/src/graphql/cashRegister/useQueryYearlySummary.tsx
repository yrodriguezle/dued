import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { getCashRegisters } from "./queries";

interface YearlySummaryData {
  monthlyData: Array<{
    month: number;
    year: number;
    totalRevenue: number; // Ricavo effettivo: (chiusura + fatture) - (apertura + spese)
    totalCash: number; // Contanti in bianco
    totalElectronic: number; // Pagamenti elettronici
    count: number;
  }>;
  yearlyTotals: {
    totalRevenue: number; // Ricavo effettivo annuale
    totalCash: number; // Totale contanti in bianco
    totalElectronic: number; // Totale pagamenti elettronici
    averageDaily: number; // Media giornaliera sul ricavo effettivo
    totalDaysWithDifferences: number;
    totalVat: number;
    count: number;
  };
}

interface UseQueryYearlySummaryProps {
  year: number;
  skip?: boolean;
}

export function useQueryYearlySummary({ year, skip = false }: UseQueryYearlySummaryProps) {
  // Recupera tutte le casse dell'anno con una singola query
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  const whereClause = `date >= '${startDate}' AND date <= '${endDate}'`;

  const { data, loading, error, refetch } = useQuery(getCashRegisters, {
    variables: {
      pageSize: 1000, // Numero massimo di record per anno
      where: whereClause,
      orderBy: "date ASC",
    },
    skip,
  });

  const yearlyData: YearlySummaryData = useMemo(() => {
    const cashRegisters = data?.connection?.cashRegisters?.edges?.map(edge => edge.node) || [];

    // Aggrega dati per mese
    const monthlyMap = new Map<number, {
      month: number;
      year: number;
      totalRevenue: number;
      totalCash: number;
      totalElectronic: number;
      count: number;
    }>();

    // Inizializza tutti i 12 mesi
    for (let m = 1; m <= 12; m++) {
      monthlyMap.set(m, {
        month: m,
        year,
        totalRevenue: 0,
        totalCash: 0,
        totalElectronic: 0,
        count: 0,
      });
    }

    // Aggrega i dati dalle casse
    let totalDaysWithDifferences = 0;
    let totalVat = 0;

    cashRegisters.forEach((cr: CashRegister) => {
      // Estrai anno e mese dalla data (usa UTC per evitare problemi di timezone)
      // La data arriva come ISO string: "2024-08-21T00:00:00.000Z"
      const dateParts = cr.date.split('T')[0].split('-'); // ["2024", "08", "21"]
      const recordYear = parseInt(dateParts[0], 10); // 2024
      const month = parseInt(dateParts[1], 10); // 8

      // FILTRO SICUREZZA: Salta record che non appartengono all'anno selezionato
      // Questo serve se il backend non filtra correttamente la query WHERE
      if (recordYear !== year) {
        return; // Salta questo record
      }

      const monthData = monthlyMap.get(month);
      if (monthData) {
        // Ricavo effettivo: (chiusura + fatture) - (apertura + spese)
        const dailyRevenue =
          (cr.closingTotal || 0) + (cr.invoicePayments || 0) -
          (cr.openingTotal || 0) - (cr.supplierExpenses || 0) - (cr.dailyExpenses || 0);

        monthData.totalRevenue += dailyRevenue;
        monthData.totalCash += cr.cashInWhite || 0;
        monthData.totalElectronic += cr.electronicPayments || 0;
        monthData.count += 1;
      }

      // Conta giorni con differenze significative (>5€)
      if (Math.abs(cr.difference || 0) > 5) {
        totalDaysWithDifferences += 1;
      }

      totalVat += cr.vatAmount || 0;
    });

    const monthlyData = Array.from(monthlyMap.values());

    // Calcola totali annuali
    const yearlyTotals = monthlyData.reduce(
      (acc, month) => ({
        totalRevenue: acc.totalRevenue + month.totalRevenue,
        totalCash: acc.totalCash + month.totalCash,
        totalElectronic: acc.totalElectronic + month.totalElectronic,
        averageDaily: 0, // Calcolato dopo
        totalDaysWithDifferences,
        totalVat,
        count: acc.count + month.count,
      }),
      {
        totalRevenue: 0,
        totalCash: 0,
        totalElectronic: 0,
        averageDaily: 0,
        totalDaysWithDifferences: 0,
        totalVat: 0,
        count: 0,
      }
    );

    // Calcola la media giornaliera sul ricavo effettivo (su giorni effettivi, non su 365)
    yearlyTotals.averageDaily = yearlyTotals.count > 0 ? yearlyTotals.totalRevenue / yearlyTotals.count : 0;

    return {
      monthlyData,
      yearlyTotals,
    };
  }, [data, year]);

  return {
    data: yearlyData,
    loading,
    error,
    refetch,
  };
}

export default useQueryYearlySummary;
