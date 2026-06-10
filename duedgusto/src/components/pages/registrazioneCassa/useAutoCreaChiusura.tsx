import { useEffect, useRef, useState } from "react";
import { NavigateFunction } from "react-router";

interface CreaChiusuraResult {
  data?: {
    chiusureMensili: {
      creaChiusuraMensile: ChiusuraMensile | null;
    };
  } | null;
}

interface UseAutoCreaChiusuraOptions {
  isNewMode: boolean;
  anno: number;
  mese: number;
  creaChiusura: (options: { variables: { anno: number; mese: number } }) => Promise<CreaChiusuraResult>;
  navigate: NavigateFunction;
}

/**
 * Auto-creazione della bozza di chiusura mensile in modalità "nuova"
 * (lift letterale da MonthlyClosureDetails: effect + ref one-shot + stato errore).
 * Se la chiusura esiste già (errore con "ID: <n>"), naviga alla chiusura esistente.
 */
function useAutoCreaChiusura({ isNewMode, anno, mese, creaChiusura, navigate }: UseAutoCreaChiusuraOptions) {
  const autoCreateInitiated = useRef(false);
  const [autoCreateError, setAutoCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (isNewMode && anno && mese && !autoCreateInitiated.current) {
      autoCreateInitiated.current = true;
      creaChiusura({ variables: { anno, mese } })
        .then((result) => {
          const nuovaChiusura = result.data?.chiusureMensili.creaChiusuraMensile;
          if (nuovaChiusura) {
            navigate(`/gestionale/cassa/chiusura-mensile/${nuovaChiusura.chiusuraId}`, { replace: true });
          } else {
            setAutoCreateError("La creazione non ha restituito dati.");
          }
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "";
          const existingIdMatch = message.match(/ID:\s*(\d+)/);
          if (existingIdMatch) {
            navigate(`/gestionale/cassa/chiusura-mensile/${existingIdMatch[1]}`, { replace: true });
            return;
          }
          setAutoCreateError(message || "Errore nella creazione della chiusura");
        });
    }
  }, [isNewMode, anno, mese, creaChiusura, navigate]);

  return { autoCreateError };
}

export default useAutoCreaChiusura;
