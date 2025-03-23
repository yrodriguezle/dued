import { useEffect, useRef } from "react";
import useGetLoggedUser from "../../common/authentication/useGetLoggedUser";
import { useNavigate } from "react-router";
import useStore from "../../store/useStore";

function useBootstrap() {
  const { user } = useStore((store) => store);
  const navigate = useNavigate();
  const fetchUser = useGetLoggedUser();
  const hasFetchedRef = useRef(false); // Flag per evitare chiamate multiple

  useEffect(() => {
    console.log('useBootstrap', user);
    if (!hasFetchedRef.current && !user) {
      hasFetchedRef.current = true; // Impostiamo il flag per non ripetere il fetch
      (async function bootstrap() {
        try {
          await fetchUser();
        } catch (error) {
          console.log('error', error);
          navigate("/signin", { replace: true });
        }
      })();
    }
  }, [fetchUser, navigate, user]);
}

export default useBootstrap;
