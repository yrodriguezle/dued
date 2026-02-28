import { useMutation } from "@apollo/client";
import { mutationSubmitRuolo, SubmitRuoloValues } from "./mutations";

function useSubmitRuolo() {
  const [mutate, { data, error, loading }] = useMutation(mutationSubmitRuolo);

  const submitRuolo = async (variables: SubmitRuoloValues) => {
    const result = await mutate({
      variables,
    });
    if (result.data?.authentication?.mutateRuolo) {
      return result.data.authentication.mutateRuolo;
    }
    return null;
  };

  return {
    submitRuolo,
    data,
    error,
    loading,
  };
}

export default useSubmitRuolo;
