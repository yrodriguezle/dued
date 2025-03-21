import { useMutation } from "@apollo/client";
import { mutationSignIn, SigninValues } from "./mutations";
import { setAuthToken } from "../../common/authentication/auth";

function useSignIn() {
  const [mutate, { data, error, loading }] = useMutation(mutationSignIn);

  const signIn = async (variables: SigninValues) => {
    const result = await mutate({
      variables,
    });
    if (result.data?.authentication?.signIn) {
      const {
        data: {
          authentication: { signIn },
        },
      } = result;
      setAuthToken(signIn);
      return true;
    }
    return false;
  };

  return {
    signIn,
    data,
    error,
    loading,
  };
}

export default useSignIn;
