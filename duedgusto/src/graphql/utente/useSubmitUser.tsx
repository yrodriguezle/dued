import { useMutation } from "@apollo/client";
import { mutationSubmitUtente, SubmitUtenteValues } from "./mutations";

function useSubmitUtente() {
  const [mutate, { data, error, loading }] = useMutation(mutationSubmitUtente);

  const submitUtente = async (variables: SubmitUtenteValues) => {
    const result = await mutate({
      variables,
    });
    if (result.data?.authentication?.mutateUtente) {
      return result.data.authentication.mutateUtente;
    }
    return null;
  };

  return {
    submitUtente,
    data,
    error,
    loading,
  };
}

export default useSubmitUtente;
