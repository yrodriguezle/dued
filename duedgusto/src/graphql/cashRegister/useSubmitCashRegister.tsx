import { useMutation } from "@apollo/client";
import { mutationSubmitCashRegister, SubmitCashRegisterValues } from "./mutations";
import { getCashRegister } from "./queries";

function useSubmitCashRegister() {
  const [mutate, { data, error, loading }] = useMutation(mutationSubmitCashRegister);

  const submitCashRegister = async (variables: SubmitCashRegisterValues) => {
    const result = await mutate({
      variables,
      // Aggiorna la cache:
      // 1. Ricarica la query specifica per la data corrente
      // 2. Ricarica tutte le query attive "GetCashRegisters" (vista mensile)
      refetchQueries: [
        {
          query: getCashRegister,
          variables: { date: variables.cashRegister.date },
        },
        "GetCashRegisters",
      ],
      awaitRefetchQueries: false,
    });
    if (result.data?.cashManagement?.mutateCashRegister) {
      return result.data.cashManagement.mutateCashRegister;
    }
    return null;
  };

  return {
    submitCashRegister,
    data,
    error,
    loading,
  };
}

export default useSubmitCashRegister;
