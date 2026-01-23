import { useQuery } from "@apollo/client";
import { getDenominazioni } from "./queries";

// Funzione per mappare denominazioni italiane in inglesi per retrocompatibilità
function mapDenominazioniToLegacy(denominazioni: DenominazioneMoneta[]): DenominazioneMoneta[] {
  return denominazioni.map(d => ({
    ...d,
    // Alias inglesi
    denominationId: d.id,
    value: d.valore,
    type: d.tipo,
    displayOrder: d.ordineVisualizzazione,
  }));
}

function useQueryDenominations() {
  const { data, error, loading } = useQuery(getDenominazioni);

  const rawDenominazioni = data?.cashManagement?.denominazioni || [];
  const denominazioni = mapDenominazioniToLegacy(rawDenominazioni);

  return {
    denominazioni,
    // Legacy alias
    denominations: denominazioni,
    error,
    loading,
  };
}

export default useQueryDenominations;
