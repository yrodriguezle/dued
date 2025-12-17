/**
 * Token Refresh Manager
 *
 * Coordina il refresh del token tra Apollo Client (GraphQL) e makeRequest (REST API)
 * per evitare chiamate duplicate simultanee a /api/auth/refresh
 */

import refreshToken from "../../api/refreshToken";
import logger from "../logger/logger";

// Flag per evitare chiamate multiple simultanee al refresh token
let isRefreshing = false;
let pendingCallbacks: Array<(success: boolean) => void> = [];
let refreshPromise: Promise<boolean> | null = null;

/**
 * Esegue il refresh del token garantendo che ci sia una sola chiamata alla volta.
 * Se un refresh è già in corso, le chiamate successive attendono il completamento.
 *
 * @returns Promise che si risolve con true se il refresh ha successo, false altrimenti
 */
export async function executeTokenRefresh(): Promise<boolean> {
  // Se c'è già un refresh in corso, attendi il suo completamento
  if (isRefreshing && refreshPromise) {
    logger.warn("Token refresh already in progress, waiting for completion...");
    return refreshPromise;
  }

  logger.log("Starting token refresh...");
  isRefreshing = true;

  // Crea una nuova promise di refresh
  refreshPromise = refreshToken()
    .then((success) => {
      logger.log(`Token refresh ${success ? 'succeeded' : 'failed'}`);
      // Notifica tutti i callback in attesa
      pendingCallbacks.forEach((callback) => callback(success));
      pendingCallbacks = [];
      return success;
    })
    .catch((error) => {
      logger.error("Token refresh error:", error);
      // Notifica tutti i callback in attesa del fallimento
      pendingCallbacks.forEach((callback) => callback(false));
      pendingCallbacks = [];
      return false;
    })
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * Registra una callback da eseguire quando il refresh del token si completa.
 * Utilizzato per mettere in coda richieste che devono attendere il nuovo token.
 *
 * @param callback Funzione da chiamare con il risultato del refresh (true/false)
 */
export function onTokenRefreshComplete(callback: (success: boolean) => void): void {
  if (isRefreshing) {
    pendingCallbacks.push(callback);
  } else {
    // Se non c'è un refresh in corso, esegui subito la callback con false
    callback(false);
  }
}

/**
 * Verifica se è in corso un refresh del token
 */
export function isTokenRefreshInProgress(): boolean {
  return isRefreshing;
}
