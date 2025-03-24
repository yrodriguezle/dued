import { useCallback } from "react";
import useStore from "../../store/useStore";
import { removeAuthToken, removeLastActivity } from "./auth";
import { useApolloClient } from "@apollo/client";
import { useNavigate } from "react-router";

function useSignOut() {
  const navigate = useNavigate();
  const client = useApolloClient();
  const { receiveUser } = useStore((store: Store) => store);

  return useCallback(() => {
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
