import { useMutation } from "@apollo/client";
import { mutationDeleteRuolo } from "./mutations";

function useDeleteRuolo() {
  const [mutate, { loading }] = useMutation(mutationDeleteRuolo);

  const deleteRuolo = async (id: number) => {
    const result = await mutate({ variables: { id } });
    return result.data?.authentication?.deleteRuolo ?? false;
  };

  return { deleteRuolo, loading };
}

export default useDeleteRuolo;
