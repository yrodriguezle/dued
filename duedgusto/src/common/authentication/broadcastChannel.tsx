/**
 * BroadcastChannel per la sincronizzazione dell'autenticazione tra tab.
 *
 * Gestisce due tipi di messaggi:
 * - TOKEN_REFRESHED: un'altra tab ha aggiornato il token JWT
 * - LOGOUT: un'altra tab ha eseguito il logout
 */

import { setAuthToken } from "./auth";
import onRefreshFails from "./onRefreshFails";
import logger from "../logger/logger";

const CHANNEL_NAME = "duedgusto-auth";

type AuthMessageType = "TOKEN_REFRESHED" | "LOGOUT";

interface TokenRefreshedMessage {
  type: "TOKEN_REFRESHED";
  payload: AuthToken;
}

interface LogoutMessage {
  type: "LOGOUT";
}

type AuthMessage = TokenRefreshedMessage | LogoutMessage;

let channel: BroadcastChannel | null = null;

const isBroadcastChannelSupported = (): boolean => typeof window !== "undefined" && "BroadcastChannel" in window;

/**
 * Gestisce i messaggi ricevuti da altre tab.
 */
const handleMessage = (event: MessageEvent<AuthMessage>) => {
  const { data } = event;

  const handlers: Record<AuthMessageType, () => void> = {
    TOKEN_REFRESHED: () => {
      const message = data as TokenRefreshedMessage;
      if (message.payload) {
        logger.log("BroadcastChannel: token aggiornato da un'altra tab");
        setAuthToken(message.payload);
      }
    },
    LOGOUT: () => {
      logger.log("BroadcastChannel: logout eseguito da un'altra tab");
      onRefreshFails();
    },
  };

  const handler = handlers[data?.type];
  if (handler) {
    handler();
  }
};

/**
 * Inizializza il BroadcastChannel per la sincronizzazione dell'autenticazione.
 * Da chiamare al mount dell'applicazione.
 */
export const initAuthChannel = (): void => {
  if (!isBroadcastChannelSupported()) {
    logger.warn("BroadcastChannel non supportato dal browser");
    return;
  }

  // Evita inizializzazioni multiple
  if (channel) return;

  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = handleMessage;
};

/**
 * Notifica le altre tab che il token JWT è stato aggiornato.
 */
export const broadcastTokenRefreshed = (token: AuthToken): void => {
  if (!channel) return;

  try {
    const message: TokenRefreshedMessage = {
      type: "TOKEN_REFRESHED",
      payload: token,
    };
    channel.postMessage(message);
  } catch (error) {
    logger.warn("BroadcastChannel: errore nell'invio TOKEN_REFRESHED", error);
  }
};

/**
 * Notifica le altre tab che l'utente ha eseguito il logout.
 */
export const broadcastLogout = (): void => {
  if (!channel) return;

  try {
    const message: LogoutMessage = { type: "LOGOUT" };
    channel.postMessage(message);
  } catch (error) {
    logger.warn("BroadcastChannel: errore nell'invio LOGOUT", error);
  }
};

/**
 * Chiude il BroadcastChannel. Da chiamare all'unmount dell'applicazione.
 */
export const cleanupAuthChannel = (): void => {
  if (!channel) return;

  channel.close();
  channel = null;
};
