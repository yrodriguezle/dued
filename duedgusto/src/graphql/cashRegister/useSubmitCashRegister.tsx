import { useMutation } from "@apollo/client";
import { mutationSubmitCashRegister, SubmitCashRegisterValues } from "./mutations";

function useSubmitCashRegister() {
  const [mutate, { data, error, loading }] = useMutation(mutationSubmitCashRegister);

  const submitCashRegister = async (variables: SubmitCashRegisterValues) => {
    const result = await mutate({
      variables,
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
