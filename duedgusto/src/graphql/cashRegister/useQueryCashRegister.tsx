import { useQuery } from "@apollo/client";
import { getRegistroCassa } from "./queries";

interface UseQueryRegistroCassaParams {
  data: string;
  skip?: boolean;
}

// Funzione per mappare i campi italiani in inglesi per retrocompatibilità
function mapRegistroCassaToLegacy(registro: RegistroCassa | null): RegistroCassa | null {
  if (!registro) return null;

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

function useQueryCashRegister({ data: dataParam, skip = false }: UseQueryRegistroCassaParams) {
  const { data, error, loading, refetch } = useQuery(getRegistroCassa, {
    variables: { data: dataParam },
    skip,
  });

  const registroCassa = data?.cashManagement?.registroCassa || null;
  const mappedRegistro = mapRegistroCassaToLegacy(registroCassa);

  return {
    registroCassa: mappedRegistro,
    // Legacy alias
    cashRegister: mappedRegistro,
    error,
    loading,
    refetch,
  };
}

export default useQueryCashRegister;
