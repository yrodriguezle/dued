import { useMutation } from "@apollo/client";
import { mutationSubmitUser, SubmitUserValues } from "./mutations";

function useSubmitUser() {
  const [mutate, { data, error, loading }] = useMutation(mutationSubmitUser);

  const submitUser = async (variables: SubmitUserValues) => {
    const result = await mutate({
      variables,
    });
    if (result.data?.authentication?.mutateUser) {
      return result.data.authentication.mutateUser;
    }
    return null;
  };

  return {
    submitUser,
    data,
    error,
    loading,
  };
}

export default useSubmitUser;
