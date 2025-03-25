import { useLazyQuery } from "@apollo/client";
import { getCurrentUser } from "./queries";

function useLazyQueryLoggedUser() {
  const [fetchLoggedUser] = useLazyQuery(getCurrentUser);
  return fetchLoggedUser;
}

export default useLazyQueryLoggedUser;
