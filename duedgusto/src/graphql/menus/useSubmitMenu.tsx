import { useMutation } from "@apollo/client";
import { mutationSubmitMenus, SubmitMenusValues } from "./mutations";

function useSubmitMenu() {
  const [mutate, { data, error, loading }] = useMutation(mutationSubmitMenus);

  const submitMenus = async (variables: SubmitMenusValues) => {
    const result = await mutate({
      variables,
    });
    if (result.data?.authentication?.mutateMenus) {
      return result.data.authentication.mutateMenus;
    }
    return null;
  };

  return {
    submitMenus,
    data,
    error,
    loading,
  };
}

export default useSubmitMenu;
