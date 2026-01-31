import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { getRegistriCassa } from "./queries";

interface YearlySummaryData {
  monthlyData: Array<{
    month: number;
    year: number;
    totalRevenue: number; // Ricavo effettivo: (chiusura + fatture) - (apertura + spese)
    totalCash: number; // Pago in contanti (battuto sulla cassa fiscale)
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
  // Use 'data' (Italian field name) in the where clause
  const whereClause = `data >= '${startDate}' AND data <= '${endDate}'`;

  const { data, loading, error, refetch } = useQuery(getRegistriCassa, {
    variables: {
      pageSize: 1000, // Numero massimo di record per anno
      where: whereClause,
      orderBy: "data ASC",
    },
    skip,
  });

  const yearlyData: YearlySummaryData = useMemo(() => {
    const registriCassa = data?.connection?.registriCassa?.items || [];

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

    registriCassa.forEach((cr: RegistroCassa) => {
      // Estrai anno e mese dalla data (usa UTC per evitare problemi di timezone)
      // La data arriva come ISO string: "2024-08-21T00:00:00.000Z"
      const dateValue = cr.data || "";
      const dateParts = dateValue.split('T')[0].split('-'); // ["2024", "08", "21"]
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
        const closingTotal = cr.totaleChiusura ?? 0;
        const invoicePayments = cr.incassiFattura ?? 0;
        const openingTotal = cr.totaleApertura ?? 0;
        const supplierExpenses = cr.speseFornitori ?? 0;
        const dailyExpenses = cr.speseGiornaliere ?? 0;
        const cashInWhite = cr.incassoContanteTracciato ?? 0;
        const electronicPayments = cr.incassiElettronici ?? 0;
        const difference = cr.differenza ?? 0;
        const vatAmount = cr.importoIva ?? 0;

        const dailyRevenue = closingTotal + invoicePayments - openingTotal - supplierExpenses - dailyExpenses;

        monthData.totalRevenue += dailyRevenue;
        monthData.totalCash += cashInWhite;
        monthData.totalElectronic += electronicPayments;
        monthData.count += 1;

        // Conta giorni con differenze significative (>5€)
        if (Math.abs(difference) > 5) {
          totalDaysWithDifferences += 1;
        }

        totalVat += vatAmount;
      }
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
