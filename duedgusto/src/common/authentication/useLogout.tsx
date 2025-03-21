import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../../store/useStore";
import { removeAuthToken, removeLastActivity } from "./auth";
import { useApolloClient } from "@apollo/client";

function useLogout() {
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
      navigate("/login");
    } else {
      window.location.reload();
    }
  }, [client, navigate, receiveUser]);
}

export default useLogout;
