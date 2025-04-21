import { useMutation } from "@apollo/client"
import { mutationSubmitRole, SubmitRoleValues } from "./mutations";

function useSubmitRole() {
  const [mutate, { data, error, loading}] = useMutation(mutationSubmitRole);

  const submitRole = async (variables: SubmitRoleValues) => {
    const result = await mutate({
      variables,
    });
    if (result.data?.authentication?.mutateRole) {
      return result.data.authentication.mutateRole;
    }
    return null;
  };

  return {
    submitRole,
    data,
    error,
    loading,
  };
}

export default useSubmitRole