import { useMutation } from "@apollo/client";
import { mutationMutateProdottoVetrina } from "./mutations";

function useSubmitProdottoVetrina() {
  const [mutate, { data, error, loading }] = useMutation(mutationMutateProdottoVetrina);

  const submitProdottoVetrina = async (prodottoId: number, input: ProdottoVetrinaInput) => {
    const result = await mutate({
      variables: { prodottoId, input },
    });
    if (result.data?.vetrina?.mutateProdottoVetrina) {
      return result.data.vetrina.mutateProdottoVetrina;
    }
    return null;
  };

  return {
    submitProdottoVetrina,
    data,
    error,
    loading,
  };
}

export default useSubmitProdottoVetrina;
