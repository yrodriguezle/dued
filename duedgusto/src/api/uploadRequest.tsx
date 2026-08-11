import { getAuthHeaders } from "../common/authentication/auth";
import onRefreshFails from "../common/authentication/onRefreshFails";
import { executeTokenRefresh } from "../common/authentication/tokenRefreshManager";
import { WEB_REQUEST_PAYLOAD_TOO_LARGE } from "./httpStatusCodes";
import { valutaStatoAutenticazione } from "./politicaRefresh";

const defaultServices = {
  getAuthHeaders,
  refreshToken: executeTokenRefresh,
};

type RispostaGrezza = {
  status: number;
  corpo: string;
};

/**
 * Estrae il messaggio dal corpo, se il corpo è JSON.
 *
 * Il try/catch non è prudenza generica: su un 413 nginx risponde con una pagina HTML e un
 * JSON.parse nudo lancerebbe un SyntaxError al posto del messaggio che l'utente deve leggere.
 */
function messaggioDalCorpo(corpo: string): string | null {
  try {
    const contenuto = JSON.parse(corpo);
    return typeof contenuto?.message === "string" ? contenuto.message : null;
  } catch {
    return null;
  }
}

function interpreta<T>({ status, corpo }: RispostaGrezza): T | null {
  if (status >= 200 && status < 300) {
    if (!corpo) {
      return null;
    }
    try {
      return JSON.parse(corpo) as T;
    } catch {
      return null;
    }
  }

  const messaggio = messaggioDalCorpo(corpo);
  if (messaggio) {
    throw new Error(messaggio);
  }
  if (status === WEB_REQUEST_PAYLOAD_TOO_LARGE) {
    throw new Error("Il file supera il limite consentito dal server");
  }
  throw new Error("Errore nella risposta del server");
}

/**
 * Invio multipart con avanzamento, per le rotte che `makeRequest` non può servire:
 * quello hardcoda `Content-Type: application/json` e `JSON.stringify(data)`.
 *
 * XHR e non `fetch` per una ragione sola: `fetch` non espone alcun evento di progresso in
 * upload. L'unica alternativa sarebbe un `ReadableStream` come body, che richiede
 * `duplex: "half"` e HTTP/2 e non è supportato ovunque.
 *
 * La politica sul 401 non è duplicata qui: è la stessa di `makeRequest` (politicaRefresh.tsx).
 */
async function uploadRequest<T>({ path, formData, onProgress }: UploadRequest, services = defaultServices): Promise<T | null> {
  const invia = () =>
    new Promise<RispostaGrezza>((resolve, reject) => {
      // Azzerare il progresso all'inizio di OGNI tentativo: senza, al retry la barra
      // tornerebbe indietro dal 100% e sembrerebbe un guasto.
      onProgress?.(0);

      // Nuovo XHR a ogni tentativo: un XHR già inviato non è reinviabile. Il FormData
      // invece si riusa senza problemi — non è uno stream, l'invio non lo consuma.
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${(window as Global).API_ENDPOINT}/api/${path}`);
      xhr.withCredentials = true;

      // getAuthHeaders() letto QUI, dentro il tentativo: leggerlo una volta sola davanti a
      // entrambi rimanderebbe lo stesso token scaduto, prenderebbe un secondo 401 e
      // finirebbe in logout — file perso e utente buttato fuori.
      const authHeaders = services.getAuthHeaders();
      if (authHeaders?.Authorization) {
        xhr.setRequestHeader("Authorization", authHeaders.Authorization);
      }
      xhr.setRequestHeader("Accept", "application/json");
      // NIENTE Content-Type: lo genera il browser, col boundary del multipart.

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress?.(event.loaded / event.total);
        }
      };
      xhr.onload = () => resolve({ status: xhr.status, corpo: xhr.responseText });
      xhr.onerror = () => reject(new Error("Errore di rete durante il caricamento"));
      xhr.onabort = () => reject(new Error("Caricamento annullato"));

      xhr.send(formData);
    });

  const primoTentativo = await invia();
  const esito = await valutaStatoAutenticazione(primoTentativo.status, {
    failOnForbidden: false,
    refreshToken: services.refreshToken,
  });

  if (esito === "abbandona") {
    // Refresh fallito: onRefreshFails l'ha già chiamato la politica.
    return null;
  }

  if (esito === "procedi") {
    return interpreta<T>(primoTentativo);
  }

  // Un solo retry, col token appena rinnovato. Costo accettato: il file riparte da zero,
  // non esiste resume — con un tetto di 20 MB sono pochi secondi.
  const secondoTentativo = await invia();
  const esitoFinale = await valutaStatoAutenticazione(secondoTentativo.status, {
    failOnForbidden: true,
    refreshToken: services.refreshToken,
  });

  if (esitoFinale === "abbandona") {
    // 401 anche col token nuovo: la sessione non è recuperabile e un terzo giro sarebbe
    // l'inizio di un ciclo. Qui il logout lo chiude questa funzione, non la politica.
    await onRefreshFails();
    return null;
  }

  return interpreta<T>(secondoTentativo);
}

export default uploadRequest;
