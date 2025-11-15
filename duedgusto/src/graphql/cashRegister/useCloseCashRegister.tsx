import { useMutation } from "@apollo/client";
import { mutationCloseCashRegister } from "./mutations";

function useCloseCashRegister() {
  const [mutate, { data, error, loading }] = useMutation(mutationCloseCashRegister);

  const closeCashRegister = async (registerId: number) => {
    const result = await mutate({
      variables: { registerId },
    });
    if (result.data?.cashManagement?.closeCashRegister) {
      return result.data.cashManagement.closeCashRegister;
    }
    return null;
  };

  return {
    closeCashRegister,
    data,
    error,
    loading,
  };
}

export default useCloseCashRegister;
