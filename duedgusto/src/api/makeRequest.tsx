import { getAuthHeaders } from "../common/authentication/auth";
import { executeTokenRefresh } from "../common/authentication/tokenRefreshManager";
import logger from "../common/logger/logger";
import { valutaStatoAutenticazione } from "./politicaRefresh";

const defaultServices = {
  fetch: window.fetch.bind(window),
  getAuthHeaders,
  refreshToken: executeTokenRefresh,
};

async function makeRequest<T, InputData>({ path, method, data, headers = {}, failOnForbidden = false }: MakeRequest<InputData>, services = defaultServices): Promise<T | null> {
  const authHeaders = services.getAuthHeaders();

  const mergedHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json;charset=UTF-8",
    ...headers,
    ...(authHeaders || {}),
  };

  const response = await services.fetch(`${(window as Global).API_ENDPOINT}/api/${path}`, {
    method,
    credentials: "include", // Include httpOnly cookies in requests
    body: data ? JSON.stringify(data) : undefined,
    headers: mergedHeaders,
  });

  if (response.ok) {
    const contentLength = response.headers.get("content-length");
    if (contentLength === "0") {
      return null;
    }
    const responseText = await response.clone().text();
    if (!responseText) {
      return null;
    }
    let responseData;
    try {
      responseData = await response.json();
    } catch (error) {
      logger.error(error);
    }
    return responseData;
  }

  // La decisione sul 401 non vive qui: è la stessa che usa uploadRequest (politicaRefresh.tsx).
  const esito = await valutaStatoAutenticazione(response.status, {
    failOnForbidden,
    refreshToken: services.refreshToken,
  });

  // Il retry è la chiamata ricorsiva: rilegge gli header dalla cima della funzione, quindi
  // parte col token appena rinnovato invece che con quello scaduto.
  if (esito === "riprova") {
    return makeRequest({
      path,
      method,
      data,
      headers,
      failOnForbidden: true,
    });
  }

  // "abbandona" con failOnForbidden = true è il 401 del retry (o di un chiamante che il
  // refresh non lo vuole): non è una sessione da chiudere in silenzio, è un errore da far
  // vedere, e prosegue nella gestione qui sotto. Senza failOnForbidden invece il refresh è
  // fallito, onRefreshFails è già stato chiamato dalla politica e non c'è altro da dire.
  if (esito === "abbandona" && !failOnForbidden) {
    return null;
  }

  // 403 Forbidden
  if (response.status === 403) {
    logger.error("Request forbidden (403)");
    throw new Error("Richiesta non autorizzata");
  }

  const err = await response.json();
  throw new Error(err.message || "Errore nella risposta del server");
}

export default makeRequest;
