import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";

export interface EsclusioneLocale {
  data: string;
  codiceMotivo: CodiceMotivo;
  note: string;
  selected: boolean;
}

interface UseGiorniEsclusiOptions {
  chiusuraMensile: ChiusuraMensile | undefined;
  giorniMancanti: string[];
}

/**
 * Derivazioni dei giorni esclusi/mancanti di una chiusura mensile
 * (lift letterale da MonthlyClosureDetails: parse JSON giorniEsclusi,
 * giorni effettivamente mancanti, stato locale delle esclusioni da proporre).
 */
function useGiorniEsclusi({ chiusuraMensile, giorniMancanti }: UseGiorniEsclusiOptions) {
  const giorniEsclusiParsed: GiornoEscluso[] = useMemo(() => {
    if (!chiusuraMensile?.giorniEsclusi) return [];
    try {
      return JSON.parse(chiusuraMensile.giorniEsclusi) as GiornoEscluso[];
    } catch {
      return [];
    }
  }, [chiusuraMensile?.giorniEsclusi]);

  const giorniEsclusiSet = useMemo(() => new Set(giorniEsclusiParsed.map((e) => dayjs(e.data).format("YYYY-MM-DD"))), [giorniEsclusiParsed]);

  const giorniEffettivamenteMancanti = useMemo(() => giorniMancanti.filter((d) => !giorniEsclusiSet.has(dayjs(d).format("YYYY-MM-DD"))), [giorniMancanti, giorniEsclusiSet]);
  const hasRegistriMancanti = giorniEffettivamenteMancanti.length > 0;
  const hasGiorniDaGestire = hasRegistriMancanti || giorniEsclusiParsed.length > 0;

  const [esclusioniLocali, setEsclusioniLocali] = useState<EsclusioneLocale[]>([]);

  useEffect(() => {
    setEsclusioniLocali((prev) => {
      const newDates = giorniEffettivamenteMancanti.map((d) => dayjs(d).format("YYYY-MM-DD"));
      const prevDates = prev.map((e) => e.data);

      if (newDates.length === prevDates.length && newDates.every((d, i) => d === prevDates[i])) {
        return prev;
      }

      return newDates.map((d) => ({
        data: d,
        codiceMotivo: "ATTIVITA_NON_AVVIATA" as CodiceMotivo,
        note: "",
        selected: false,
      }));
    });
  }, [giorniEffettivamenteMancanti]);

  return {
    giorniEsclusiParsed,
    giorniEffettivamenteMancanti,
    hasRegistriMancanti,
    hasGiorniDaGestire,
    esclusioniLocali,
    setEsclusioniLocali,
  };
}

export default useGiorniEsclusi;
