import { useCallback, useState } from "react";
import uploadRequest from "../../api/uploadRequest";

export type StatoCaricamento = "in-corso" | "completato" | "errore";

export type AvanzamentoFile = {
  nomeFile: string;
  /** Da 0 a 1. Riparte da 0 se il caricamento viene ritentato dopo un refresh del token. */
  avanzamento: number;
  stato: StatoCaricamento;
  messaggio?: string;
};

type OpzioniCaricamento = {
  cartella?: string;
  alt?: string;
};

/**
 * Carica un'immagine per volta su `POST /api/media`, tenendo lo stato di avanzamento **per
 * file**: la libreria ne accetta più d'uno alla volta e una barra sola non saprebbe a quale
 * riferirsi.
 *
 * Il caricamento passa da `uploadRequest` e non da Apollo: il client GraphQL del progetto non
 * ha un link multipart, e `makeRequest` hardcoda `Content-Type: application/json`.
 */
function useUploadMedia() {
  const [avanzamenti, setAvanzamenti] = useState<Record<string, AvanzamentoFile>>({});

  const aggiorna = useCallback((chiave: string, patch: Partial<AvanzamentoFile>) => {
    setAvanzamenti((precedenti) => ({
      ...precedenti,
      [chiave]: { ...precedenti[chiave], ...patch },
    }));
  }, []);

  /**
   * `chiave` identifica la riga di progresso: il nome del file non basta, si possono
   * selezionare due file omonimi da cartelle diverse.
   */
  const caricaMedia = useCallback(
    async (chiave: string, file: File, opzioni: OpzioniCaricamento = {}): Promise<MediaCaricato | null> => {
      const formData = new FormData();
      formData.append("file", file);
      if (opzioni.cartella) {
        formData.append("cartella", opzioni.cartella);
      }
      if (opzioni.alt) {
        formData.append("alt", opzioni.alt);
      }

      setAvanzamenti((precedenti) => ({
        ...precedenti,
        [chiave]: { nomeFile: file.name, avanzamento: 0, stato: "in-corso" },
      }));

      try {
        const caricato = await uploadRequest<MediaCaricato>({
          path: "media",
          formData,
          onProgress: (avanzamento) => aggiorna(chiave, { avanzamento }),
        });
        aggiorna(chiave, { avanzamento: 1, stato: "completato" });
        return caricato;
      } catch (error) {
        // Il messaggio arriva dal corpo JSON del server (o dalla traduzione del 413) ed è già
        // in italiano e già spiegato: mostrarlo così com'è, senza riscriverlo.
        aggiorna(chiave, {
          stato: "errore",
          messaggio: error instanceof Error ? error.message : "Caricamento non riuscito",
        });
        return null;
      }
    },
    [aggiorna]
  );

  const azzeraAvanzamenti = useCallback(() => setAvanzamenti({}), []);

  const caricamentiInCorso = Object.values(avanzamenti).some((avanzamento) => avanzamento.stato === "in-corso");

  return {
    caricaMedia,
    avanzamenti,
    azzeraAvanzamenti,
    caricamentiInCorso,
  };
}

export default useUploadMedia;
