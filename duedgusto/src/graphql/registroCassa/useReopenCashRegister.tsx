import { useMutation } from "@apollo/client";
import { mutationRiapriRegistroCassa } from "./mutations";

function useReopenCashRegister() {
  const [mutate, { data, error, loading }] = useMutation(mutationRiapriRegistroCassa);

  const riapriRegistroCassa = async (registroCassaId: number) => {
    const result = await mutate({
      variables: { registroCassaId },
      refetchQueries: ["GetRegistroCassa"],
    });
    if (result.data?.gestioneCassa?.riapriRegistroCassa) {
      return result.data.gestioneCassa.riapriRegistroCassa;
    }
    return null;
  };

  return {
    riapriRegistroCassa,
    data,
    error,
    loading,
  };
}

export default useReopenCashRegister;
