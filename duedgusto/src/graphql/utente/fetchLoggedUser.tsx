import configureClient from "../configureClient";
import { getUtenteCorrente } from "./queries";

async function fetchLoggedUser() {
  const client = configureClient();
  return await client.query({
    query: getUtenteCorrente,
  });
}

export default fetchLoggedUser;
