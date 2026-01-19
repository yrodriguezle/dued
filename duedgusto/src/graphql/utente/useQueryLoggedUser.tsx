import { useQuery } from "@apollo/client";
import { getUtenteCorrente } from "./queries";

function useQueryLoggedUser() {
  return useQuery(getUtenteCorrente);
}

export default useQueryLoggedUser;
