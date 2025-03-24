import { useEffect } from "react";
import useGetLoggedUser from "../../common/authentication/useGetLoggedUser";
import useStore from "../../store/useStore";
import useSignOut from "../../common/authentication/useSignOut";

function useBootstrap() {
  const { user, inProgress } = useStore((store) => store);
  const fetchUser = useGetLoggedUser();
  const signOut = useSignOut();

  useEffect(() => {
    (async () => {
      if (!inProgress.fetchUser && !user) {
        try {
          await fetchUser();
        } catch (error) {
          console.log(error);
          signOut();
        }
      }
    })();
  }, [fetchUser, inProgress.fetchUser, signOut, user]);
}

export default useBootstrap;
