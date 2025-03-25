import { useQuery } from "@apollo/client";
import { getCurrentUser } from "./queries";

function useQueryLoggedUser() {
  return useQuery(getCurrentUser);
}

export default useQueryLoggedUser;
