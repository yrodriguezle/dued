import { useMutation } from "@apollo/client";
import { mutationSubmitRegistroCassa, SubmitRegistroCassaValues } from "./mutations";
import { getRegistroCassa } from "./queries";

function useSubmitCashRegister() {
  const [mutate, { data, error, loading }] = useMutation(mutationSubmitRegistroCassa);

  const submitRegistroCassa = async (variables: SubmitRegistroCassaValues) => {
    const result = await mutate({
      variables,
      // Aggiorna la cache:
      // 1. Ricarica la query specifica per la data corrente
      // 2. Ricarica tutte le query attive "GetRegistriCassaConnection" (vista mensile)
      refetchQueries: [
        {
          query: getRegistroCassa,
          variables: { data: variables.registroCassa.data },
        },
        "GetRegistriCassaConnection",
      ],
      awaitRefetchQueries: false,
    });
    if (result.data?.cashManagement?.mutateRegistroCassa) {
      return result.data.cashManagement.mutateRegistroCassa;
    }
    return null;
  };

  // Legacy alias
  const submitCashRegister = submitRegistroCassa;

  return {
    submitRegistroCassa,
    submitCashRegister,
    data,
    error,
    loading,
  };
}

export default useSubmitCashRegister;
