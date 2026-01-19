import { useLazyQuery } from "@apollo/client";
import { getUtenteCorrente } from "./queries";

function useLazyQueryLoggedUser() {
  const [fetchLoggedUser] = useLazyQuery(getUtenteCorrente);
  return fetchLoggedUser;
}

export default useLazyQueryLoggedUser;
