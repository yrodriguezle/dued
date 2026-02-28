import configureClient from "../../graphql/configureClient";
import useStore from "../../store/useStore";
import { removeAuthToken, removeRememberPassword } from "./auth";
import showToast from "../toast/showToast";
import logger from "../logger/logger";
import { navigateTo } from "../navigator/navigator";

async function onRefreshFails() {
  try {
    showToast({
      type: "error",
      position: "bottom-right",
      message: "Utente non autenticato",
      autoClose: false,
      toastId: "refresh-token-error",
    });

    const { receiveUtente } = useStore.getState();
    const client = configureClient();
    removeAuthToken();
    removeRememberPassword();
    receiveUtente(null);
    if (location.pathname !== "/signin") {
      if (client) {
        client.resetStore();
      }
      navigateTo("signin");
    }
  } catch (error) {
    logger.log(error);
  }
}

export default onRefreshFails;
