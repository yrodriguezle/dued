import configureClient from "../configureClient";
import { getCurrentUser } from "./queries";

async function fetchLoggedUser() {
  const client = configureClient();
  return await client.query({
    query: getCurrentUser
  });
}

export default fetchLoggedUser