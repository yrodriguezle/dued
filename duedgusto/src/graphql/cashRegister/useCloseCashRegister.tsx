import { useMutation } from "@apollo/client";
import { mutationChiudiRegistroCassa } from "./mutations";

function useCloseCashRegister() {
  const [mutate, { data, error, loading }] = useMutation(mutationChiudiRegistroCassa);

  const chiudiRegistroCassa = async (registroCassaId: number) => {
    const result = await mutate({
      variables: { registroCassaId },
      // Aggiorna la cache per riflettere lo stato CLOSED nella vista mensile
      refetchQueries: ["GetRegistriCassa", "GetRegistroCassa"],
      awaitRefetchQueries: false,
    });
    if (result.data?.gestioneCassa?.chiudiRegistroCassa) {
      return result.data.gestioneCassa.chiudiRegistroCassa;
    }
    return null;
  };

  // Legacy alias
  const closeCashRegister = chiudiRegistroCassa;

  return {
    chiudiRegistroCassa,
    closeCashRegister,
    data,
    error,
    loading,
  };
}

export default useCloseCashRegister;
