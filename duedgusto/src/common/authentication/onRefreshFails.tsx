import configureClient from "../../graphql/configureClient";
import useStore from "../../store/useStore";
import { removeAuthToken, removeLastActivity, removeRememberPassword } from "./auth";
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

    const { receiveUser } = useStore.getState();
    const client = configureClient();
    removeAuthToken();
    removeLastActivity();
    removeRememberPassword();
    receiveUser(null);
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
