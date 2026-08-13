import { useMutation } from "@apollo/client";
import { mutationMutateProdotto } from "./mutations";

function useSubmitProdotto() {
  const [mutate, { data, error, loading }] = useMutation(mutationMutateProdotto);

  const submitProdotto = async (prodotto: ProdottoCassaInput) => {
    const result = await mutate({ variables: { prodotto } });
    if (result.data?.vendite?.mutateProdotto) {
      return result.data.vendite.mutateProdotto;
    }
    return null;
  };

  return {
    submitProdotto,
    data,
    error,
    loading,
  };
}

export default useSubmitProdotto;
