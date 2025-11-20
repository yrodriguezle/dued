import makeRequest from "./makeRequest";

async function fetchLoggedUser() {
  return makeRequest<User, null>({
    path: "auth",
    method: "GET",
  });
}

export default fetchLoggedUser;
