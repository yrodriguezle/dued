import onRefreshFails from "../common/authentication/onRefreshFails";
import logger from "../common/logger/logger";
import { WEB_REQUEST_UNAUTHORIZED } from "./httpStatusCodes";

export type EsitoAutenticazione = "procedi" | "riprova" | "abbandona";

type OpzioniPolitica = {
  failOnForbidden: boolean;
  refreshToken: () => Promise<boolean>;
};

/**
 * Politica unica "401 → refresh → un solo retry", condivisa da `makeRequest` (fetch)
 * e `uploadRequest` (XHR).
 *
 * Non conosce il trasporto: riceve uno status, decide. È deliberato — duplicare la
 * decisione dentro ogni trasporto significa due copie che divergono al primo bugfix
 * applicato a una sola, e il sintomo sarebbe un utente buttato fuori a metà upload.
 *
 * I tre esiti:
 * - `procedi`   — non è un 401, la risposta va interpretata così com'è;
 * - `riprova`   — il refresh è riuscito, il chiamante ripete la richiesta UNA volta,
 *                 rileggendo gli header (il token è cambiato proprio adesso);
 * - `abbandona` — la sessione non è recuperabile, oppure eravamo già all'ultimo
 *                 tentativo. Nel primo caso `onRefreshFails()` è già stato chiamato.
 */
export async function valutaStatoAutenticazione(status: number, { failOnForbidden, refreshToken }: OpzioniPolitica): Promise<EsitoAutenticazione> {
  if (status !== WEB_REQUEST_UNAUTHORIZED) {
    return "procedi";
  }

  // Ultimo tentativo: un secondo refresh qui aprirebbe un ciclo senza fine fra 401 e
  // rinnovo. Chi chiama decide se il 401 è un errore da mostrare o una sessione da chiudere.
  if (failOnForbidden) {
    return "abbandona";
  }

  logger.log("Ricevuto 401, tentativo di refresh del token");
  if (await refreshToken()) {
    return "riprova";
  }

  await onRefreshFails();
  return "abbandona";
}

export default valutaStatoAutenticazione;
