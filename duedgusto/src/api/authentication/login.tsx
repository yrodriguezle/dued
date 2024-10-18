import makeRequest from "../makeRequest";

type SingInInputData = {
  username: string;
  password: string;
};

async function login(data: SingInInputData) { // onError: (response: Response) => void
  return makeRequest<AuthToken|null, SingInInputData>({
    path: 'authentication/login',
    method: 'POST',
    data,
    // onError,
    failOnForbidden: true,
  });
}

export default login;