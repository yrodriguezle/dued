import { useCallback } from "react";
import useStore from "../../store/useStore";
import { getAuthToken, removeAuthToken } from "./auth";
import { broadcastLogout } from "./broadcastChannel";
import { useApolloClient } from "@apollo/client";
import { useNavigate } from "react-router";
import logger from "../logger/logger";

function useSignOut() {
  const navigate = useNavigate();
  const client = useApolloClient();
  const { receiveUtente } = useStore((store: Store) => store);

  return useCallback(async () => {
    // Call logout API to clear refresh token cookie on server
    try {
      const authToken = getAuthToken();
      await fetch(`${(window as Global).API_ENDPOINT}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(authToken?.token ? { Authorization: `Bearer ${authToken.token}` } : {}),
        },
        body: JSON.stringify({
          token: authToken?.token || "",
        }),
      });
    } catch (error) {
      // Log error but continue with client-side logout
      logger.warn("Error calling logout API:", error);
    }

    // Notify other tabs about logout
    broadcastLogout();

    // Clear client-side authentication
    removeAuthToken();
    receiveUtente(null);
    if (client) {
      client.resetStore();
    }
    if (navigate) {
      navigate("/signin", { replace: true });
    } else {
      window.location.reload();
    }
  }, [client, navigate, receiveUtente]);
}

export default useSignOut;
