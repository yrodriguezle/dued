import { useCallback } from "react";
import useStore from "../../store/useStore";
import { removeAuthToken, removeLastActivity } from "./auth";
import { useApolloClient } from "@apollo/client";
import { useNavigate } from "react-router";
import logger from "../logger/logger";

function useSignOut() {
  const navigate = useNavigate();
  const client = useApolloClient();
  const { receiveUser } = useStore((store: Store) => store);

  return useCallback(async () => {
    // Call logout API to clear refresh token cookie on server
    try {
      await fetch(`${(window as Global).API_ENDPOINT}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      // Log error but continue with client-side logout
      logger.warn("Error calling logout API:", error);
    }

    // Clear client-side authentication
    removeAuthToken();
    removeLastActivity();
    receiveUser(null);
    if (client) {
      client.resetStore();
    }
    if (navigate) {
      navigate("/signin", { replace: true });
    } else {
      window.location.reload();
    }
  }, [client, navigate, receiveUser]);
}

export default useSignOut;
