import { useState } from "react";
import { setAuthToken } from "../../common/authentication/auth";
import makeRequest from "../../api/makeRequest";

export type SigninValues = {
  username: string;
  password: string;
};

function useSignIn() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signIn = async (variables: SigninValues) => {
    setLoading(true);
    setError(null);

    try {
      const result = await makeRequest<{ token: string; refreshToken: string }, SigninValues>({
        path: "auth/signin",
        method: "POST",
        data: variables,
      });

      if (result?.token && result?.token) {
        setAuthToken({ token: result.token, refreshToken: result.refreshToken });
        setLoading(false);

        return true;
      }
      setLoading(false);
      return false;
    } catch (err) {
      setError(err as Error);
      setLoading(false);
      return false;
    }
  };

  return {
    signIn,
    error,
    loading,
  };
}

export default useSignIn;
