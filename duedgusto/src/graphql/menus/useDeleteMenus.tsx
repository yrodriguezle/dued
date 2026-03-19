import { useMutation } from "@apollo/client";
import { mutationDeleteMenus } from "./mutations";

function useDeleteMenus() {
  const [mutate, { loading }] = useMutation(mutationDeleteMenus);

  const deleteMenus = async (ids: number[]) => {
    if (ids.length === 0) {
      return true;
    }
    const result = await mutate({ variables: { ids } });
    return result.data?.authentication?.deleteMenus ?? false;
  };

  return { deleteMenus, loading };
}

export default useDeleteMenus;
